Created At: 2026-06-21T07:11:31Z
Completed At: 2026-06-21T07:11:33Z
File Path: `file:///D:/school-bus-system/server/index.js`
Total Lines: 949
Total Bytes: 31800
Showing lines 1 to 800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import express from 'express';
2: import cors from 'cors';
3: import rateLimit from 'express-rate-limit';
4: import { fileURLToPath } from 'url';
5: import { config } from './config.js';
6: import * as sheets from './services/sheets.js';
7: import { getAdminPassword, getReceptionPin, getDriverPins, updateCredential, getAllCredentials } from './services/credentials.js';
8: import {
9:   sendBoardingNotification,
10:   sendCrossBusBoardingNotification,
11:   sendCrossBusReturnBoardingNotification,
12:   sendReturnBoardingNotification,
13:   sendDropoffNotification,
14:   sendBusStartedNotification,
15:   sendReturnJourneyStartedNotification,
16:   sendMorningTripEndedNotification,
17:   sendReturnJourneyEndedNotification,
18:   sendCollegeArrivalNotification,
19:   sendAdminMissedScanAlert,
20:   sendWhatsAppNotification,
21: } from './services/whatsapp.js';
22: import {
23:   formatBusNumber,
24:   busNumberKey,
25:   busesMatch,
26:   getISTDateString,
27:   formatISTTime,
28:   getScanType,
29:   getDriverScanType,
30:   isDropoffMode,
31:   FEE_ALERT_MESSAGE,
32:   isFeeDue,
33: } from './utils.js';
34: import * as reassignments from './services/reassignments.js';
35: 
36: const app = express();
37: 
38: app.use(cors());
39: app.use(express.json());
40: 
41: const lookupLimiter = rateLimit({
42:   windowMs: 2 * 60 * 1000,
43:   max: 5,
44:   message: { error: 'Too many lookup attempts, please try again after 2 minutes' }
45: });
46: 
47: function nowTimestamp() {
48:   return new Date().toISOString();
49: }
50: 
51: app.post('/api/admin/student/:id/lookup-credentials', async (req, res) => {
52:     const { password, last4 } = req.body;
53:     if (password !== (await getAdminPassword())) return res.status(401).json({ error: 'Unauthorized' });
54:     
55:     if (!last4 || !/^\d{4}$/.test(last4)) {
56:       return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
57:     }
58: 
59:     try {
60:       await sheets.updateStudentLookupCredential(req.params.id, last4);
61:       res.json({ success: true });
62:     } catch (e) {
63:       res.status(400).json({ error: e.message });
64:     }
65:   });
66: 
67:   app.post('/api/lookup', lookupLimiter, async (req, res) => {
68:     try {
69:       const { student_id, last4 } = req.body;
70:       if (!student_id || !last4) {
71:         return res.status(400).json({ error: 'Student ID and 4-digit PIN required' });
72:       }
73: 
74:       const student = await sheets.getStudentById(student_id.trim().toUpperCase());
75:       if (!student) {
76:         return res.status(404).json({ error: 'Student not found' });
77:       }
78: 
79:       if (!student.lookup_phone_last4) {
80:         return res.status(401).json({ error: 'Lookup not yet set up for this student — please contact admin' });
81:       }
82: 
83:       if (student.lookup_phone_last4 !== last4) {
84:         return res.status(401).json({ error: 'Invalid credentials' });
85:       }
86: 
87:       const today = getISTDateString();
88:       const attendance = await sheets.getTodayAttendance();
89:       const records = attendance.filter(r => r.student_id === student.student_id && r.date === today);
90:       
91:       let status = 'Not yet boarded';
92:       let timestamp = null;
93: 
94:       const dropoff = records.filter(r => r.scan_type === 'dropoff').pop();
95:       const boarding = records.filter(r => r.scan_type === 'boarding' || r.scan_type === 'return_boarding').pop();
96: 
97:       if (dropoff) {
98:         status = `Dropped off at ${dropoff.dropoff_time}`;
99:         timestamp = dropoff.timestamp;
100:       } else if (boarding) {
101:         const timeStr = boarding.boarded_at || new Date(boarding.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
102:         status = `Boarded at ${timeStr} on ${boarding.actual_bus || boarding.bus_number}`;
103:         timestamp = boarding.timestamp;
104:       }
105: 
106:       res.json({
107:         success: true,
108:         student: {
109:           name: student.name,
110:           class: student.class,
111:           bus_number: student.bus_number,
112:           status,
113:           last_updated: timestamp
114:         }
115:       });
116:     } catch (e) {
117:       res.status(500).json({ error: e.message });
118:     }
119:   });
120: 
121: app.get('/api/health', (_req, res) => {
122:   res.json({ status: 'ok', school: config.schoolName });
123: });
124: 
125: app.get('/api/config/scan-mode', async (req, res) => {
126:   try {
127:     const busNumber = req.query.bus_number;
128:     let bus = null;
129:     if (busNumber) bus = await sheets.getBusByNumber(busNumber);
130:     const scanType = bus ? getDriverScanType(bus) : getScanType();
131:     res.json({
132:       scanType,
133:       isDropoff: isDropoffMode(),
134:       dropoffCutoff: config.dropoffCutoffTime,
135:       journeyType: bus?.journey_type || 'idle',
136:       currentStatus: bus?.current_status || 'idle',
137:       timezone: 'Asia/Kolkata',
138:     });
139:   } catch (err) {
140:     res.status(500).json({ error: err.message });
141:   }
142: });
143: 
144: app.post('/api/driver/login', async (req, res) => {
145:   try {
146:     const { pin, busNumber } = req.body;
147:     await reassignments.revertExpiredReassignments();
148: 
149:     const pins = (await getDriverPins());
150:     const bus = busNumberKey(busNumber);
151:     if (pins[bus] && pins[bus] === String(pin)) {
152:       return res.json({ success: true, busNumber: formatBusNumber(bus) });
153:     }
154: 
155:     const active = await reassignments.getActiveReassignmentForBus(busNumber);
156:     if (active?.temp_driver_bus) {
157:       const tempBusKey = busNumberKey(active.temp_driver_bus);
158:       if (pins[tempBusKey] === String(pin)) {
159:         return res.json({
160:           success: true,
161:           busNumber: formatBusNumber(bus),
162:           tempDriver: true,
163:           tempDriverName: active.temp_driver,
164:         });
165:       }
166:     }
167: 
168:     res.status(401).json({ error: 'Invalid PIN or Bus Number' });
169:   } catch (err) {
170:     res.status(500).json({ error: err.message });
171:   }
172: });
173: 
174: app.post('/api/reception/login', async (req, res) => {
175:   const { pin } = req.body;
176:   if (String(pin) === (await getReceptionPin())) {
177:     return res.json({ success: true });
178:   }
179:   res.status(401).json({ error: 'Invalid Reception PIN' });
180: });
181: 
182: app.get('/api/driver/pins', async (_req, res) => {
183:   const pins = (await getDriverPins());
184:   res.json({ buses: Object.keys(pins).map((b) => formatBusNumber(b)) });
185: });
186: 
187: app.get('/api/students', async (_req, res) => {
188:   try {
189:     res.json(await sheets.getStudents());
190:   } catch (err) {
191:     res.status(500).json({ error: err.message });
192:   }
193: });
194: 
195: app.get('/api/attendance', async (req, res) => {
196:   try {
197:     const date = req.query.date || getISTDateString();
198:     res.json(await sheets.getAttendance(date));
199:   } catch (err) {
200:     res.status(500).json({ error: err.message });
201:   }
202: });
203: 
204: app.get('/api/incidents', async (req, res) => {
205:   try {
206:     const password = req.headers['x-admin-password'];
207:     if (password !== (await getAdminPassword())) {
208:       return res.status(401).json({ error: 'Unauthorized' });
209:     }
210:     const date = req.query.date || null;
211:     const incidents = await sheets.getIncidents(date);
212:     const busFilter = req.query.bus_number;
213:     const typeFilter = req.query.incident_type;
214:     let filtered = incidents;
215:     if (busFilter) {
216:       filtered = filtered.filter((i) => busNumberKey(i.bus_number) === busNumberKey(busFilter));
217:     }
218:     if (typeFilter) {
219:       filtered = filtered.filter((i) => i.incident_type === typeFilter);
220:     }
221:     res.json(filtered);
222:   } catch (err) {
223:     res.status(500).json({ error: err.message });
224:   }
225: });
226: 
227: app.get('/api/reception/summary', async (_req, res) => {
228:   try {
229:     res.json(await sheets.getReceptionSummary());
230:   } catch (err) {
231:     res.status(500).json({ error: err.message });
232:   }
233: });
234: 
235: app.get('/api/bus/:number', async (req, res) => {
236:   try {
237:     const bus = await sheets.getBusByNumber(req.params.number);
238:     if (!bus) return res.status(404).json({ error: 'Bus not found' });
239:     const todayAttendance = await sheets.getTodayAttendance();
240:     const busKey = busNumberKey(req.params.number);
241:     const filter = (type) => todayAttendance.filter(
242:       (a) => busNumberKey(a.bus_number) === busKey && a.scan_type === type
243:     );
244:     res.json({
245:       ...bus,
246:       boardedToday: filter('boarding'),
247:       droppedToday: filter('dropoff'),
248:       returnBoardedToday: filter('return_boarding'),
249:     });
250:   } catch (err) {
251:     res.status(500).json({ error: err.message });
252:   }
253: });
254: 
255: app.get('/api/buses', async (_req, res) => {
256:   try {
257:     res.json(await sheets.getBuses());
258:   } catch (err) {
259:     res.status(500).json({ error: err.message });
260:   }
261: });
262: 
263: app.post('/api/bus/location', async (req, res) => {
264:   try {
265:     const { bus_number, lat, lng } = req.body;
266:     if (!bus_number || lat == null || lng == null) {
267:       return res.status(400).json({ error: 'bus_number, lat, lng required' });
268:     }
269:     await sheets.updateBusLocation(bus_number, lat, lng);
270:     res.json({ success: true });
271:   } catch (err) {
272:     res.status(500).json({ error: err.message });
273:   }
274: });
275: 
276: app.post('/api/bus/start', async (req, res) => {
277:   try {
278:     const { bus_number, driver_name } = req.body;
279:     if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
280: 
281:     const formattedBus = formatBusNumber(bus_number);
282:     const bus = await sheets.getBusByNumber(bus_number);
283:     const driverName = driver_name || bus?.driver_name || 'Driver';
284:     const startTime = formatISTTime();
285: 
286:     await sheets.updateBusMorningStart(bus_number, startTime);
287: 
288:     const students = await sheets.getStudentsByBus(bus_number);
289:     let sent = 0;
290:     for (const student of students) {
291:       if (!student.parent_whatsapp) continue;
292:       const result = await sendBusStartedNotification({
293:         parentWhatsapp: student.parent_whatsapp,
294:         busNumber: formattedBus,
295:         driverName,
296:       });
297:       if (result.success) sent++;
298:     }
299: 
300:     res.json({
301:       success: true,
302:       bus_number: formattedBus,
303:       startTime,
304:       notificationsSent: sent,
305:       totalParents: students.length,
306:     });
307:   } catch (err) {
308:     res.status(500).json({ error: err.message });
309:   }
310: });
311: 
312: app.post('/api/bus/start-return', async (req, res) => {
313:   try {
314:     const { bus_number, driver_name } = req.body;
315:     if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
316: 
317:     const formattedBus = formatBusNumber(bus_number);
318:     const bus = await sheets.getBusByNumber(bus_number);
319:     const driverName = driver_name || bus?.driver_name || 'Driver';
320:     const startTime = formatISTTime();
321: 
322:     await sheets.updateBusReturnStart(bus_number, startTime);
323: 
324:     const students = await sheets.getStudentsByBus(bus_number);
325:     let sent = 0;
326:     for (const student of students) {
327:       if (!student.parent_whatsapp) continue;
328:       const result = await sendReturnJourneyStartedNotification({
329:         parentWhatsapp: student.parent_whatsapp,
330:         busNumber: formattedBus,
331:         driverName,
332:       });
333:       if (result.success) sent++;
334:     }
335: 
336:     res.json({
337:       success: true,
338:       bus_number: formattedBus,
339:       startTime,
340:       notificationsSent: sent,
341:       totalParents: students.length,
342:     });
343:   } catch (err) {
344:     res.status(500).json({ error: err.message });
345:   }
346: });
347: 
348: app.post('/api/bus/stop', async (req, res) => {
349:   try {
350:     const { bus_number, driver_name } = req.body;
351:     if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
352: 
353:     const formattedBus = formatBusNumber(bus_number);
354:     const bus = await sheets.getBusByNumber(bus_number);
355:     if (!bus) return res.status(404).json({ error: 'Bus not found' });
356:     if (bus.current_status !== 'morning_running') {
357:       return res.status(400).json({ error: 'Bus is not in morning_running status' });
358:     }
359: 
360:     const driverName = driver_name || bus.driver_name || 'Driver';
361:     const endTime = formatISTTime();
362: 
363:     await sheets.updateBusMorningStop(bus_number, endTime);
364: 
365:     const students = await sheets.getStudentsByBus(bus_number);
366:     let sent = 0;
367:     for (const student of students) {
368:       if (!student.parent_whatsapp) continue;
369:       const result = await sendMorningTripEndedNotification({
370:         parentWhatsapp: student.parent_whatsapp,
371:         busNumber: formattedBus,
372:         driverName,
373:       });
374:       if (result.success) sent++;
375:     }
376: 
377:     res.json({
378:       success: true,
379:       bus_number: formattedBus,
380:       endTime,
381:       current_status: 'idle',
382:       notificationsSent: sent,
383:     });
384:   } catch (err) {
385:     res.status(500).json({ error: err.message });
386:   }
387: });
388: 
389: app.post('/api/bus/stop-return', async (req, res) => {
390:   try {
391:     const { bus_number, driver_name } = req.body;
392:     if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
393: 
394:     const formattedBus = formatBusNumber(bus_number);
395:     const bus = await sheets.getBusByNumber(bus_number);
396:     if (!bus) return res.status(404).json({ error: 'Bus not found' });
397:     if (bus.current_status !== 'return_running') {
398:       return res.status(400).json({ error: 'Bus is not in return_running status' });
399:     }
400: 
401:     const driverName = driver_name || bus.driver_name || 'Driver';
402:     const endTime = formatISTTime();
403: 
404:     await sheets.updateBusReturnStop(bus_number, endTime);
405: 
406:     const students = await sheets.getStudentsByBus(bus_number);
407:     let sent = 0;
408:     for (const student of students) {
409:       if (!student.parent_whatsapp) continue;
410:       const result = await sendReturnJourneyEndedNotification({
411:         parentWhatsapp: student.parent_whatsapp,
412:         busNumber: formattedBus,
413:         driverName,
414:       });
415:       if (result.success) sent++;
416:     }
417: 
418:     res.json({
419:       success: true,
420:       bus_number: formattedBus,
421:       endTime,
422:       current_status: 'idle',
423:       notificationsSent: sent,
424:     });
425:   } catch (err) {
426:     res.status(500).json({ error: err.message });
427:   }
428: });
429: 
430: app.put('/api/fee/:id', async (req, res) => {
431:   try {
432:     const password = req.headers['x-admin-password'];
433:     if (password !== (await getAdminPassword())) {
434:       return res.status(401).json({ error: 'Unauthorized' });
435:     }
436:     
437:     const { duration_months, custom_date, mark_due } = req.body;
438:     const studentId = req.params.id;
439:     console.log(`[Fee Update] Request received for student ${studentId}. Payload:`, req.body);
440:     
441:     let finalDueDate = '';
442: 
443:     if (mark_due) {
444:       // By setting fee_paid_until to yesterday, it effectively marks the student as DUE
445:       const d = new Date();
446:       d.setDate(d.getDate() - 1);
447:       finalDueDate = d.toISOString().split('T')[0];
448:     } else if (custom_date) {
449:       finalDueDate = custom_date;
450:     } else if (duration_months) {
451:       const students = await sheets.getStudents();
452:       const student = students.find((s) => s.student_id === studentId);
453:       if (!student) {
454:         console.error(`[Fee Update] Student ${studentId} not found.`);
455:         return res.status(404).json({ error: 'Student not found' });
456:       }
457:       
458:       let baseDate = new Date();
459:       if (student.fee_paid_until) {
460:         const existingDate = new Date(student.fee_paid_until);
461:         if (!isNaN(existingDate) && existingDate > baseDate) {
462:           baseDate = existingDate;
463:         }
464:       }
465:       baseDate.setMonth(baseDate.getMonth() + parseInt(duration_months, 10));
466:       finalDueDate = baseDate.toISOString().split('T')[0];
467:     }
468: 
469:     console.log(`[Fee Update] Calculated final fee_paid_until for ${studentId}: ${finalDueDate}`);
470:     await sheets.updateStudentFeeStatus(studentId, finalDueDate);
471:     console.log(`[Fee Update] Successfully updated Google Sheets for ${studentId}.`);
472:     
473:     res.json({ success: true, fee_paid_until: finalDueDate });
474:   } catch (err) {
475:     console.error(`[Fee Update Error] for ${req.params.id}:`, err);
476:     res.status(500).json({ error: err.message });
477:   }
478: });
479: 
480: app.put('/api/students/:id/bus', async (req, res) => {
481:   try {
482:     const password = req.headers['x-admin-password'];
483:     if (password !== (await getAdminPassword())) {
484:       return res.status(401).json({ error: 'Unauthorized' });
485:     }
486: 
487:     const studentId = req.params.id;
488:     const { bus_number } = req.body;
489:     
490:     if (!bus_number) {
491:       return res.status(400).json({ error: 'bus_number is required' });
492:     }
493: 
494:     await sheets.updateStudentBusNumber(studentId, bus_number);
495:     console.log(`[Bus Update] Successfully updated bus for ${studentId} to ${bus_number}.`);
496: 
497:     res.json({ success: true, bus_number });
498:   } catch (err) {
499:     console.error(`[Bus Update Error] for ${req.params.id}:`, err);
500:     res.status(500).json({ error: err.message });
501:   }
502: });
503: 
504: app.put('/api/students/bulk-fee', async (req, res) => {
505:   try {
506:     const password = req.headers['x-admin-password'];
507:     if (password !== (await getAdminPassword())) {
508:       return res.status(401).json({ error: 'Unauthorized' });
509:     }
510: 
511:     const { student_ids, fee_paid_until } = req.body;
512:     if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
513:       return res.status(400).json({ error: 'student_ids must be a non-empty array' });
514:     }
515:     if (!fee_paid_until) {
516:       return res.status(400).json({ error: 'fee_paid_until is required' });
517:     }
518: 
519:     console.log(`[Bulk Fee Update] Request received for ${student_ids.length} students. Date: ${fee_paid_until}`);
520:     await sheets.bulkUpdateFeePaidUntil(student_ids, fee_paid_until);
521:     console.log(`[Bulk Fee Update] Successfully updated ${student_ids.length} students.`);
522: 
523:     res.json({ success: true, count: student_ids.length, fee_paid_until });
524:   } catch (err) {
525:     console.error(`[Bulk Fee Update Error]:`, err);
526:     res.status(500).json({ error: err.message });
527:   }
528: });
529: 
530: app.get('/api/dashboard', async (req, res) => {
531:   try {
532:     const password = req.headers['x-admin-password'];
533:     if (password !== (await getAdminPassword())) {
534:       return res.status(401).json({ error: 'Unauthorized' });
535:     }
536:     res.json(await sheets.getDashboardStats());
537:   } catch (err) {
538:     res.status(500).json({ error: err.message });
539:   }
540: });
541: 
542: app.get('/api/reassignments/active', async (req, res) => {
543:   try {
544:     const password = req.headers['x-admin-password'];
545:     if (password !== (await getAdminPassword())) {
546:       return res.status(401).json({ error: 'Unauthorized' });
547:     }
548:     const active = await reassignments.getActiveReassignments();
549:     res.json(active);
550:   } catch (err) {
551:     res.status(500).json({ error: err.message });
552:   }
553: });
554: 
555: app.post('/api/reassignments', async (req, res) => {
556:   try {
557:     const password = req.headers['x-admin-password'];
558:     if (password !== (await getAdminPassword())) {
559:       return res.status(401).json({ error: 'Unauthorized' });
560:     }
561: 
562:     const {
563:       bus_number,
564:       temp_driver,
565:       temp_driver_phone,
566:       temp_driver_bus,
567:       reason,
568:       end_date,
569:       is_temporary = true,
570:     } = req.body;
571: 
572:     if (!bus_number || !temp_driver) {
573:       return res.status(400).json({ error: 'bus_number and temp_driver are required' });
574:     }
575: 
576:     let resolvedTempDriverBus = temp_driver_bus;
577:     if (!resolvedTempDriverBus) {
578:       const buses = await sheets.getBuses();
579:       resolvedTempDriverBus = await reassignments.findDriverHomeBus(temp_driver, buses);
580:     }
581: 
582:     const result = await reassignments.createReassignment({
583:       bus_number,
584:       temp_driver,
585:       temp_driver_phone,
586:       temp_driver_bus: resolvedTempDriverBus,
587:       reason,
588:       reassigned_by: 'admin',
589:       end_date: end_date || getISTDateString(),
590:       is_temporary: is_temporary !== false && is_temporary !== 'no',
591:     });
592: 
593:     res.json({ success: true, ...result });
594:   } catch (err) {
595:     res.status(500).json({ error: err.message });
596:   }
597: });
598: 
599: app.post('/api/notify', async (req, res) => {
600:   try {
601:     const { student_id, bus_number, stop_name, scan_type } = req.body;
602:     const student = await sheets.getStudentById(student_id);
603:     if (!student) return res.status(404).json({ error: 'Student not found' });
604: 
605:     const result = await sendWhatsAppNotification({
606:       parentWhatsapp: student.parent_whatsapp,
607:       studentName: student.name,
608:       busNumber: bus_number || student.bus_number,
609:       stopName: stop_name || student.stop_name,
610:       scanType: scan_type || getScanType(),
611:     });
612: 
613:     await sheets.updateNotificationStatus(
614:       student_id,
615:       getISTDateString(),
616:       scan_type || getScanType(),
617:       result.method
618:     );
619: 
620:     res.json(result);
621:   } catch (err) {
622:     res.status(500).json({ error: err.message });
623:   }
624: });
625: 
626: async function logDuplicateIncident(student, bus, driverName, scanType) {
627:   await sheets.appendIncident({
628:     date: getISTDateString(),
629:     student_id: student.student_id,
630:     student_name: student.name,
631:     bus_number: bus,
632:     driver_name: driverName,
633:     incident_type: 'duplicate_scan',
634:     details: `Duplicate ${scanType} scan attempted`,
635:     timestamp: nowTimestamp(),
636:   });
637: }
638: 
639: app.post('/api/scan', async (req, res) => {
640:   try {
641:     const { student_id, driver_name, bus_number, stop_name } = req.body;
642:     const student = await sheets.getStudentById(student_id);
643:     if (!student) return res.status(404).json({ error: 'Student not found' });
644: 
645:     const today = getISTDateString();
646:     const formattedBus = formatBusNumber(bus_number || student.bus_number);
647:     const bus = await sheets.getBusByNumber(formattedBus);
648:     const scanType = getDriverScanType(bus);
649:     const scanTime = formatISTTime();
650:     const driverName = driver_name || bus?.driver_name || 'Driver';
651: 
652:     const existing = await sheets.findAttendanceRecord(
653:       student_id,
654:       formattedBus,
655:       today,
656:       scanType
657:     );
658: 
659:     if (existing) {
660:       await logDuplicateIncident(student, formattedBus, driverName, scanType);
661:       const action =
662:         scanType === 'dropoff' ? 'dropped off' :
663:         scanType === 'return_boarding' ? 'scanned for return' : 'scanned';
664:       return res.json({
665:         success: true,
666:         duplicate: true,
667:         scan_type: scanType,
668:         student,
669:         message: `⚠️ ${student.name} has already been ${action} today on ${formattedBus}`,
670:       });
671:     }
672: 
673:     const isDue = isFeeDue(student, today);
674:     const assignedBus = formatBusNumber(student.bus_number);
675:     const isCrossBus =
676:       ['boarding', 'return_boarding'].includes(scanType) &&
677:       !busesMatch(assignedBus, formattedBus);
678: 
679:     const record = {
680:       timestamp: nowTimestamp(),
681:       student_id: student.student_id,
682:       student_name: student.name,
683:       bus_number: formattedBus,
684:       stop_name: stop_name || student.stop_name,
685:       boarded_at: ['boarding', 'return_boarding'].includes(scanType) ? scanTime : '',
686:       driver_name: driverName,
687:       date: today,
688:       notification_status: 'pending',
689:       scan_type: scanType,
690:       dropoff_time: scanType === 'dropoff' ? scanTime : '',
691:       scanned_by: 'driver',
692:       arrival_time: '',
693:       is_cross_bus: isCrossBus,
694:       actual_bus: isCrossBus ? formattedBus : '',
695:       assigned_bus: isCrossBus ? assignedBus : '',
696:     };
697: 
698:     await sheets.appendAttendance(record);
699: 
700:     let notifyResult;
701:     if (scanType === 'dropoff') {
702:       notifyResult = await sendDropoffNotification({
703:         parentWhatsapp: student.parent_whatsapp,
704:         studentName: student.name,
705:         busNumber: formattedBus,
706:         stopName: record.stop_name,
707:       });
708:     } else if (scanType === 'return_boarding') {
709:       notifyResult = isCrossBus
710:         ? await sendCrossBusReturnBoardingNotification({
711:             parentWhatsapp: student.parent_whatsapp,
712:             studentName: student.name,
713:             actualBus: formattedBus,
714:             assignedBus,
715:           })
716:         : await sendReturnBoardingNotification({
717:             parentWhatsapp: student.parent_whatsapp,
718:             studentName: student.name,
719:             busNumber: formattedBus,
720:           });
721:     } else if (isCrossBus) {
722:       notifyResult = await sendCrossBusBoardingNotification({
723:         parentWhatsapp: student.parent_whatsapp,
724:         studentName: student.name,
725:         actualBus: formattedBus,
726:         assignedBus,
727:       });
728:     } else {
729:       notifyResult = await sendBoardingNotification({
730:         parentWhatsapp: student.parent_whatsapp,
731:         studentName: student.name,
732:         busNumber: formattedBus,
733:       });
734:     }
735: 
736:     let notificationStatus = notifyResult.method || 'none';
737:     if (['boarding', 'return_boarding'].includes(scanType) && isDue) {
738:       notificationStatus = `${notificationStatus}; fee_not_paid_alert`;
739:       await sheets.logIncidentIfNew({
740:         date: today,
741:         student_id: student.student_id,
742:         student_name: student.name,
743:         bus_number: formattedBus,
744:         driver_name: driverName,
745:         incident_type: 'fee_defaulter',
746:         details: 'Student boarded with fee status DUE',
747:         timestamp: nowTimestamp(),
748:       });
749:     }
750: 
751:     await sheets.updateNotificationStatus(student_id, today, scanType, notificationStatus);
752: 
753:     res.json({
754:       success: true,
755:       scan_type: scanType,
756:       student,
757:       record,
758:       notification: notifyResult,
759:       feeAlert: ['boarding', 'return_boarding'].includes(scanType) && isDue,
760:       feeAlertMessage: ['boarding', 'return_boarding'].includes(scanType) && isDue ? FEE_ALERT_MESSAGE : null,
761:       isCrossBus,
762:       crossBusNote: isCrossBus
763:         ? `ℹ️ Note: ${student.name}'s regular bus is ${assignedBus}, boarding ${formattedBus} today`
764:         : null,
765:     });
766:   } catch (err) {
767:     res.status(500).json({ error: err.message });
768:   }
769: });
770: 
771: app.post('/api/reception/scan', async (req, res) => {
772:   try {
773:     const { student_id } = req.body;
774:     const student = await sheets.getStudentById(student_id);
775:     if (!student) return res.status(404).json({ error: 'Student not found' });
776: 
777:     const today = getISTDateString();
778:     const formattedBus = formatBusNumber(student.bus_number);
779:     const arrivalTime = formatISTTime();
780:     const bus = await sheets.getBusByNumber(formattedBus);
781:     const driverName = bus?.driver_name || 'Unknown';
782: 
783:     const existingArrival = await sheets.findAttendanceRecord(
784:       student_id,
785:       formattedBus,
786:       today,
787:       'college_arrival'
788:     );
789: 
790:     if (existingArrival) {
791:       await sheets.appendIncident({
792:         date: today,
793:         student_id: student.student_id,
794:         student_name: student.name,
795:         bus_number: formattedBus,
796:         driver_name: driverName,
797:         incident_type: 'duplicate_scan',
798:         details: 'Duplicate college_arrival scan at reception',
799:         timestamp: nowTimestamp(),
800:       });
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
