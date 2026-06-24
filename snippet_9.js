Created At: 2026-06-21T12:40:27Z
Completed At: 2026-06-21T12:40:51Z
The following changes were made by the multi_replace_file_content tool to: D:\school-bus-system\server\index.js. If relevant, proactively run terminal commands to execute this code for the USER. Don't ask for permission.
[diff_block_start]
@@ -288,685 +288,874 @@
 
 app.put('/api/bus/:number/driver', async (req, res) => {
   try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-    const { driver_name, driver_phone } = req.body;
+      if (student.lookup_phone_last4 !== last4) {
+        return res.status(401).json({ error: 'Invalid credentials' });
+      }
+
+      const today = getISTDateString();
+      const attendance = await sheets.getTodayAttendance();
+      const records = attendance.filter(r => r.student_id === student.student_id && r.date === today);
+      
+      let status = 'Not yet boarded';
+      let timestamp = null;
+
+      const dropoff = records.filter(r => r.scan_type === 'dropoff').pop();
+      const boarding = records.filter(r => r.scan_type === 'boarding' || r.scan_type === 'return_boarding').pop();
+
+      if (dropoff) {
+        status = `Dropped off at ${dropoff.dropoff_time}`;
+        timestamp = dropoff.timestamp;
+      } else if (boarding) {
+        const timeStr = boarding.boarded_at || new Date(boarding.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
+        status = `Boarded at ${timeStr} on ${boarding.actual_bus || boarding.bus_number}`;
+        timestamp = boarding.timestamp;
+      }
+
+      res.json({
+        success: true,
+        student: {
+          name: student.name,
+          class: student.class,
+          bus_number: student.bus_number,
+          status,
+          last_updated: timestamp
+        }
+      });
+    } catch (e) {
+      res.status(500).json({ error: e.message });
+    }
+  });
+
+app.get('/api/health', (_req, res) => {
+  res.json({ status: 'ok', school: config.schoolName });
+});
+
+app.get('/api/config/scan-mode', async (req, res) => {
+  try {
+    const busNumber = req.query.bus_number;
+    let bus = null;
+    if (busNumber) bus = await sheets.getBusByNumber(busNumber);
+    const scanType = bus ? getDriverScanType(bus) : getScanType();
+    res.json({
+      scanType,
+      isDropoff: isDropoffMode(),
+      dropoffCutoff: config.dropoffCutoffTime,
+      journeyType: bus?.journey_type || 'idle',
+      currentStatus: bus?.current_status || 'idle',
+      timezone: 'Asia/Kolkata',
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/driver/login', loginLimiter, async (req, res) => {
+  try {
+    const { pin, busNumber } = req.body;
+    await reassignments.revertExpiredReassignments();
+
+    const pins = (await getDriverPins());
+    const bus = busNumberKey(busNumber);
+    if (pins[bus] && await verifyCredential(String(pin), pins[bus])) {
+      return res.json({ success: true, busNumber: formatBusNumber(bus) });
+    }
+
+    const active = await reassignments.getActiveReassignmentForBus(busNumber);
+    if (active?.temp_driver_bus) {
+      const tempBusKey = busNumberKey(active.temp_driver_bus);
+      if (await verifyCredential(String(pin), pins[tempBusKey])) {
+        return res.json({
+          success: true,
+          busNumber: formatBusNumber(bus),
+          tempDriver: true,
+          tempDriverName: active.temp_driver,
+        });
+      }
+    }
+
+    res.status(401).json({ error: 'Invalid PIN or Bus Number' });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/reception/login', loginLimiter, async (req, res) => {
+  const { pin } = req.body;
+  if (await verifyCredential(String(pin), await getReceptionPin())) {
+    return res.json({ success: true });
+  }
+  res.status(401).json({ error: 'Invalid Reception PIN' });
+});
+
+app.get('/api/driver/pins', async (_req, res) => {
+  const pins = (await getDriverPins());
+  res.json({ buses: Object.keys(pins).map((b) => formatBusNumber(b)) });
+});
+
+app.get('/api/students', async (_req, res) => {
+  try {
+    res.json(await sheets.getStudents());
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/attendance', async (req, res) => {
+  try {
+    const date = req.query.date || getISTDateString();
+    res.json(await sheets.getAttendance(date));
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/incidents', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+    const date = req.query.date || null;
+    const incidents = await sheets.getIncidents(date);
+    const busFilter = req.query.bus_number;
+    const typeFilter = req.query.incident_type;
+    let filtered = incidents;
+    if (busFilter) {
+      filtered = filtered.filter((i) => busNumberKey(i.bus_number) === busNumberKey(busFilter));
+    }
+    if (typeFilter) {
+      filtered = filtered.filter((i) => i.incident_type === typeFilter);
+    }
+    res.json(filtered);
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/reception/summary', async (_req, res) => {
+  try {
+    res.json(await sheets.getReceptionSummary());
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/bus/:number', async (req, res) => {
+  try {
+    const bus = await sheets.getBusByNumber(req.params.number);
+    if (!bus) return res.status(404).json({ error: 'Bus not found' });
+    const todayAttendance = await sheets.getTodayAttendance();
+    const busKey = busNumberKey(req.params.number);
+    const filter = (type) => todayAttendance.filter(
+      (a) => busNumberKey(a.bus_number) === busKey && a.scan_type === type
+    );
+    res.json({
+      ...bus,
+      boardedToday: filter('boarding'),
+      droppedToday: filter('dropoff'),
+      returnBoardedToday: filter('return_boarding'),
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/buses', async (_req, res) => {
+  try {
+    res.json(await sheets.getBuses());
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/bus/location', async (req, res) => {
+  try {
+    const { bus_number, lat, lng } = req.body;
+    if (!bus_number || lat == null || lng == null) {
+      return res.status(400).json({ error: 'bus_number, lat, lng required' });
+    }
+    await sheets.updateBusLocation(bus_number, lat, lng);
+    res.json({ success: true });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.put('/api/bus/:number/driver', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+    const { driver_name, driver_phone } = req.body;
     await sheets.updateBusDriverDetails(req.params.number, driver_name || '', driver_phone || '');
-    await sheets.appendAuditLog('bus_changed', req.params.number, Driver: );
-    res.json({ success: true });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/emergency', async (req, res) => {
-  try {
-    const { bus_number, driver_name } = req.body;
-    await sheets.appendIncident({
-      date: getISTDateString(),
-      student_id: '',
-      student_name: '',
-      bus_number: formatBusNumber(bus_number || ''),
-      driver_name: driver_name || 'Driver',
-      incident_type: 'emergency',
-      details: 'SOS button pressed by driver',
-      timestamp: nowTimestamp(),
-    });
-    res.json({ success: true });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/bus/start', async (req, res) => {
-  try {
-    const { bus_number, driver_name } = req.body;
-    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
-
-    const formattedBus = formatBusNumber(bus_number);
-    const bus = await sheets.getBusByNumber(bus_number);
-    const driverName = driver_name || bus?.driver_name || 'Driver';
-    const startTime = formatISTTime();
-
-    await sheets.updateBusMorningStart(bus_number, startTime);
-
-    const students = await sheets.getStudentsByBus(bus_number);
-    let sent = 0;
-    for (const student of students) {
-      if (!student.parent_whatsapp) continue;
-      const result = await sendBusStartedNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        busNumber: formattedBus,
-        driverName,
-      });
-      if (result.success) sent++;
-    }
-
-    res.json({
-      success: true,
-      bus_number: formattedBus,
-      startTime,
-      notificationsSent: sent,
-      totalParents: students.length,
-    });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/bus/start-return', async (req, res) => {
-  try {
-    const { bus_number, driver_name } = req.body;
-    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
-
-    const formattedBus = formatBusNumber(bus_number);
-    const bus = await sheets.getBusByNumber(bus_number);
-    const driverName = driver_name || bus?.driver_name || 'Driver';
-    const startTime = formatISTTime();
-
-    await sheets.updateBusReturnStart(bus_number, startTime);
-
-    const students = await sheets.getStudentsByBus(bus_number);
-    let sent = 0;
-    for (const student of students) {
-      if (!student.parent_whatsapp) continue;
-      const result = await sendReturnJourneyStartedNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        busNumber: formattedBus,
-        driverName,
-      });
-      if (result.success) sent++;
-    }
-
-    res.json({
-      success: true,
-      bus_number: formattedBus,
-      startTime,
-      notificationsSent: sent,
-      totalParents: students.length,
-    });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/bus/stop', async (req, res) => {
-  try {
-    const { bus_number, driver_name } = req.body;
-    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
-
-    const formattedBus = formatBusNumber(bus_number);
-    const bus = await sheets.getBusByNumber(bus_number);
-    if (!bus) return res.status(404).json({ error: 'Bus not found' });
-    if (bus.current_status !== 'morning_running') {
-      return res.status(400).json({ error: 'Bus is not in morning_running status' });
-    }
-
-    const driverName = driver_name || bus.driver_name || 'Driver';
-    const endTime = formatISTTime();
-
-    await sheets.updateBusMorningStop(bus_number, endTime);
-
-    const students = await sheets.getStudentsByBus(bus_number);
-    let sent = 0;
-    for (const student of students) {
-      if (!student.parent_whatsapp) continue;
-      const result = await sendMorningTripEndedNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        busNumber: formattedBus,
-        driverName,
-      });
-      if (result.success) sent++;
-    }
-
-    res.json({
-      success: true,
-      bus_number: formattedBus,
-      endTime,
-      current_status: 'idle',
-      notificationsSent: sent,
-    });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/bus/stop-return', async (req, res) => {
-  try {
-    const { bus_number, driver_name } = req.body;
-    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
-
-    const formattedBus = formatBusNumber(bus_number);
-    const bus = await sheets.getBusByNumber(bus_number);
-    if (!bus) return res.status(404).json({ error: 'Bus not found' });
-    if (bus.current_status !== 'return_running') {
-      return res.status(400).json({ error: 'Bus is not in return_running status' });
-    }
-
-    const driverName = driver_name || bus.driver_name || 'Driver';
-    const endTime = formatISTTime();
-
-    await sheets.updateBusReturnStop(bus_number, endTime);
-
-    const students = await sheets.getStudentsByBus(bus_number);
-    let sent = 0;
-    for (const student of students) {
-      if (!student.parent_whatsapp) continue;
-      const result = await sendReturnJourneyEndedNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        busNumber: formattedBus,
-        driverName,
-      });
-      if (result.success) sent++;
-    }
-
-    res.json({
-      success: true,
-      bus_number: formattedBus,
-      endTime,
-      current_status: 'idle',
-      notificationsSent: sent,
-    });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.put('/api/fee/:id', async (req, res) => {
-  try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-    
-    const { duration_months, custom_date, mark_due } = req.body;
-    const studentId = req.params.id;
-    console.log(`[Fee Update] Request received for student ${studentId}. Payload:`, req.body);
-    
-    let finalDueDate = '';
-
-    if (mark_due) {
-      // By setting fee_paid_until to yesterday, it effectively marks the student as DUE
-      const d = new Date();
-      d.setDate(d.getDate() - 1);
-      finalDueDate = d.toISOString().split('T')[0];
-    } else if (custom_date) {
-      finalDueDate = custom_date;
-    } else if (duration_months) {
-      const students = await sheets.getStudents();
-      const student = students.find((s) => s.student_id === studentId);
-      if (!student) {
-        console.error(`[Fee Update] Student ${studentId} not found.`);
-        return res.status(404).json({ error: 'Student not found' });
-      }
-      
-      let baseDate = new Date();
-      if (student.fee_paid_until) {
-        const existingDate = new Date(student.fee_paid_until);
-        if (!isNaN(existingDate) && existingDate > baseDate) {
-          baseDate = existingDate;
-        }
-      }
-      baseDate.setMonth(baseDate.getMonth() + parseInt(duration_months, 10));
-      finalDueDate = baseDate.toISOString().split('T')[0];
-    }
-
-    console.log(`[Fee Update] Calculated final fee_paid_until for ${studentId}: ${finalDueDate}`);
+    await sheets.appendAuditLog('bus_changed', req.params.number, `Driver: ${driver_name || ''}`);
+    res.json({ success: true });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/emergency', async (req, res) => {
+  try {
+    const { bus_number, driver_name } = req.body;
+    await sheets.appendIncident({
+      date: getISTDateString(),
+      student_id: '',
+      student_name: '',
+      bus_number: formatBusNumber(bus_number || ''),
+      driver_name: driver_name || 'Driver',
+      incident_type: 'emergency',
+      details: 'SOS button pressed by driver',
+      timestamp: nowTimestamp(),
+    });
+    res.json({ success: true });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/bus/start', async (req, res) => {
+  try {
+    const { bus_number, driver_name } = req.body;
+    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
+
+    const formattedBus = formatBusNumber(bus_number);
+    const bus = await sheets.getBusByNumber(bus_number);
+    const driverName = driver_name || bus?.driver_name || 'Driver';
+    const startTime = formatISTTime();
+
+    await sheets.updateBusMorningStart(bus_number, startTime);
+
+    const students = await sheets.getStudentsByBus(bus_number);
+    let sent = 0;
+    for (const student of students) {
+      if (!student.parent_whatsapp) continue;
+      const result = await sendBusStartedNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        busNumber: formattedBus,
+        driverName,
+      });
+      if (result.success) sent++;
+    }
+
+    res.json({
+      success: true,
+      bus_number: formattedBus,
+      startTime,
+      notificationsSent: sent,
+      totalParents: students.length,
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/bus/start-return', async (req, res) => {
+  try {
+    const { bus_number, driver_name } = req.body;
+    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
+
+    const formattedBus = formatBusNumber(bus_number);
+    const bus = await sheets.getBusByNumber(bus_number);
+    const driverName = driver_name || bus?.driver_name || 'Driver';
+    const startTime = formatISTTime();
+
+    await sheets.updateBusReturnStart(bus_number, startTime);
+
+    const students = await sheets.getStudentsByBus(bus_number);
+    let sent = 0;
+    for (const student of students) {
+      if (!student.parent_whatsapp) continue;
+      const result = await sendReturnJourneyStartedNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        busNumber: formattedBus,
+        driverName,
+      });
+      if (result.success) sent++;
+    }
+
+    res.json({
+      success: true,
+      bus_number: formattedBus,
+      startTime,
+      notificationsSent: sent,
+      totalParents: students.length,
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/bus/stop', async (req, res) => {
+  try {
+    const { bus_number, driver_name } = req.body;
+    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
+
+    const formattedBus = formatBusNumber(bus_number);
+    const bus = await sheets.getBusByNumber(bus_number);
+    if (!bus) return res.status(404).json({ error: 'Bus not found' });
+    if (bus.current_status !== 'morning_running') {
+      return res.status(400).json({ error: 'Bus is not in morning_running status' });
+    }
+
+    const driverName = driver_name || bus.driver_name || 'Driver';
+    const endTime = formatISTTime();
+
+    await sheets.updateBusMorningStop(bus_number, endTime);
+
+    const students = await sheets.getStudentsByBus(bus_number);
+    let sent = 0;
+    for (const student of students) {
+      if (!student.parent_whatsapp) continue;
+      const result = await sendMorningTripEndedNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        busNumber: formattedBus,
+        driverName,
+      });
+      if (result.success) sent++;
+    }
+
+    res.json({
+      success: true,
+      bus_number: formattedBus,
+      endTime,
+      current_status: 'idle',
+      notificationsSent: sent,
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/bus/stop-return', async (req, res) => {
+  try {
+    const { bus_number, driver_name } = req.body;
+    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
+
+    const formattedBus = formatBusNumber(bus_number);
+    const bus = await sheets.getBusByNumber(bus_number);
+    if (!bus) return res.status(404).json({ error: 'Bus not found' });
+    if (bus.current_status !== 'return_running') {
+      return res.status(400).json({ error: 'Bus is not in return_running status' });
+    }
+
+    const driverName = driver_name || bus.driver_name || 'Driver';
+    const endTime = formatISTTime();
+
+    await sheets.updateBusReturnStop(bus_number, endTime);
+
+    const students = await sheets.getStudentsByBus(bus_number);
+    let sent = 0;
+    for (const student of students) {
+      if (!student.parent_whatsapp) continue;
+      const result = await sendReturnJourneyEndedNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        busNumber: formattedBus,
+        driverName,
+      });
+      if (result.success) sent++;
+    }
+
+    res.json({
+      success: true,
+      bus_number: formattedBus,
+      endTime,
+      current_status: 'idle',
+      notificationsSent: sent,
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.put('/api/fee/:id', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+    
+    const { duration_months, custom_date, mark_due } = req.body;
+    const studentId = req.params.id;
+    console.log(`[Fee Update] Request received for student ${studentId}. Payload:`, req.body);
+    
+    let finalDueDate = '';
+
+    if (mark_due) {
+      // By setting fee_paid_until to yesterday, it effectively marks the student as DUE
+      const d = new Date();
+      d.setDate(d.getDate() - 1);
+      finalDueDate = d.toISOString().split('T')[0];
+    } else if (custom_date) {
+      finalDueDate = custom_date;
+    } else if (duration_months) {
+      const students = await sheets.getStudents();
+      const student = students.find((s) => s.student_id === studentId);
+      if (!student) {
+        console.error(`[Fee Update] Student ${studentId} not found.`);
+        return res.status(404).json({ error: 'Student not found' });
+      }
+      
+      let baseDate = new Date();
+      if (student.fee_paid_until) {
+        const existingDate = new Date(student.fee_paid_until);
+        if (!isNaN(existingDate) && existingDate > baseDate) {
+          baseDate = existingDate;
+        }
+      }
+      baseDate.setMonth(baseDate.getMonth() + parseInt(duration_months, 10));
+      finalDueDate = baseDate.toISOString().split('T')[0];
+    }
+
+    console.log(`[Fee Update] Calculated final fee_paid_until for ${studentId}: ${finalDueDate}`);
     await sheets.updateStudentFeeStatus(studentId, finalDueDate);
-    await sheets.appendAuditLog('fee_updated', studentId, finalDueDate);
-    console.log(`[Fee Update] Successfully updated Google Sheets for ${studentId}.`);
-    
-    res.json({ success: true, fee_paid_until: finalDueDate });
-  } catch (err) {
-    console.error(`[Fee Update Error] for ${req.params.id}:`, err);
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.put('/api/students/:id/bus', async (req, res) => {
-  try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-
-    const studentId = req.params.id;
-    const { bus_number } = req.body;
-    
-    if (!bus_number) {
-      return res.status(400).json({ error: 'bus_number is required' });
-    }
-
-    await sheets.updateStudentBusNumber(studentId, bus_number);
-    console.log(`[Bus Update] Successfully updated bus for ${studentId} to ${bus_number}.`);
-
-    res.json({ success: true, bus_number });
-  } catch (err) {
-    console.error(`[Bus Update Error] for ${req.params.id}:`, err);
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.put('/api/students/bulk-fee', async (req, res) => {
-  try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-
-    const { student_ids, fee_paid_until } = req.body;
-    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
-      return res.status(400).json({ error: 'student_ids must be a non-empty array' });
-    }
-    if (!fee_paid_until) {
-      return res.status(400).json({ error: 'fee_paid_until is required' });
-    }
-
-    console.log(`[Bulk Fee Update] Request received for ${student_ids.length} students. Date: ${fee_paid_until}`);
-    await sheets.bulkUpdateFeePaidUntil(student_ids, fee_paid_until);
-    console.log(`[Bulk Fee Update] Successfully updated ${student_ids.length} students.`);
-
-    res.json({ success: true, count: student_ids.length, fee_paid_until });
-  } catch (err) {
-    console.error(`[Bulk Fee Update Error]:`, err);
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.get('/api/dashboard', async (req, res) => {
-  try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-    res.json(await sheets.getDashboardStats());
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.get('/api/reassignments/active', async (req, res) => {
-  try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-    const active = await reassignments.getActiveReassignments();
-    res.json(active);
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/reassignments', async (req, res) => {
-  try {
-    const password = req.headers['x-admin-password'];
-    if (!(await verifyCredential(password, await getAdminPassword()))) {
-      return res.status(401).json({ error: 'Unauthorized' });
-    }
-
-    const {
-      bus_number,
-      temp_driver,
-      temp_driver_phone,
-      temp_driver_bus,
-      reason,
-      end_date,
-      is_temporary = true,
-    } = req.body;
-
-    if (!bus_number || !temp_driver) {
-      return res.status(400).json({ error: 'bus_number and temp_driver are required' });
-    }
-
-    let resolvedTempDriverBus = temp_driver_bus;
-    if (!resolvedTempDriverBus) {
-      const buses = await sheets.getBuses();
-      resolvedTempDriverBus = await reassignments.findDriverHomeBus(temp_driver, buses);
-    }
-
-    const result = await reassignments.createReassignment({
-      bus_number,
-      temp_driver,
-      temp_driver_phone,
-      temp_driver_bus: resolvedTempDriverBus,
-      reason,
-      reassigned_by: 'admin',
-      end_date: end_date || getISTDateString(),
-      is_temporary: is_temporary !== false && is_temporary !== 'no',
-    });
-
-    res.json({ success: true, ...result });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/notify', async (req, res) => {
-  try {
-    const { student_id, bus_number, stop_name, scan_type } = req.body;
-    const student = await sheets.getStudentById(student_id);
-    if (!student) return res.status(404).json({ error: 'Student not found' });
-
-    const result = await sendWhatsAppNotification({
-      parentWhatsapp: student.parent_whatsapp,
-      studentName: student.name,
-      busNumber: bus_number || student.bus_number,
-      stopName: stop_name || student.stop_name,
-      scanType: scan_type || getScanType(),
-    });
-
-    await sheets.updateNotificationStatus(
-      student_id,
-      getISTDateString(),
-      scan_type || getScanType(),
-      result.method
-    );
-
-    res.json(result);
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-async function logDuplicateIncident(student, bus, driverName, scanType) {
-  await sheets.appendIncident({
-    date: getISTDateString(),
-    student_id: student.student_id,
-    student_name: student.name,
-    bus_number: bus,
-    driver_name: driverName,
-    incident_type: 'duplicate_scan',
-    details: `Duplicate ${scanType} scan attempted`,
-    timestamp: nowTimestamp(),
-  });
-}
-
-app.post('/api/scan', async (req, res) => {
-  try {
-    const { student_id, driver_name, bus_number, stop_name } = req.body;
-    const student = await sheets.getStudentById(student_id);
-    if (!student) return res.status(404).json({ error: 'Student not found' });
-
-    const today = getISTDateString();
-    const formattedBus = formatBusNumber(bus_number || student.bus_number);
-    const bus = await sheets.getBusByNumber(formattedBus);
-    const scanType = getDriverScanType(bus);
-    const scanTime = formatISTTime();
-    const driverName = driver_name || bus?.driver_name || 'Driver';
-
-    const existing = await sheets.findAttendanceRecord(
-      student_id,
-      formattedBus,
-      today,
-      scanType
-    );
-
-    if (existing) {
-      await logDuplicateIncident(student, formattedBus, driverName, scanType);
-      const action =
-        scanType === 'dropoff' ? 'dropped off' :
-        scanType === 'return_boarding' ? 'scanned for return' : 'scanned';
-      return res.json({
-        success: true,
-        duplicate: true,
-        scan_type: scanType,
-        student,
-        message: `⚠️ ${student.name} has already been ${action} today on ${formattedBus}`,
-      });
-    }
-
-    const isDue = isFeeDue(student, today);
-    const assignedBus = formatBusNumber(student.bus_number);
-    const isCrossBus =
-      ['boarding', 'return_boarding'].includes(scanType) &&
-      !busesMatch(assignedBus, formattedBus);
-
-    const record = {
-      timestamp: nowTimestamp(),
-      student_id: student.student_id,
-      student_name: student.name,
-      bus_number: formattedBus,
-      stop_name: stop_name || student.stop_name,
-      boarded_at: ['boarding', 'return_boarding'].includes(scanType) ? scanTime : '',
-      driver_name: driverName,
-      date: today,
-      notification_status: 'pending',
-      scan_type: scanType,
-      dropoff_time: scanType === 'dropoff' ? scanTime : '',
-      scanned_by: 'driver',
-      arrival_time: '',
-      is_cross_bus: isCrossBus,
-      actual_bus: isCrossBus ? formattedBus : '',
-      assigned_bus: isCrossBus ? assignedBus : '',
-    };
-
-    await sheets.appendAttendance(record);
-
-    let notifyResult;
-    if (scanType === 'dropoff') {
-      notifyResult = await sendDropoffNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        studentName: student.name,
-        busNumber: formattedBus,
-        stopName: record.stop_name,
-      });
-    } else if (scanType === 'return_boarding') {
-      notifyResult = isCrossBus
-        ? await sendCrossBusReturnBoardingNotification({
-            parentWhatsapp: student.parent_whatsapp,
-            studentName: student.name,
-            actualBus: formattedBus,
-            assignedBus,
-          })
-        : await sendReturnBoardingNotification({
-            parentWhatsapp: student.parent_whatsapp,
-            studentName: student.name,
-            busNumber: formattedBus,
-          });
-    } else if (isCrossBus) {
-      notifyResult = await sendCrossBusBoardingNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        studentName: student.name,
-        actualBus: formattedBus,
-        assignedBus,
-      });
-    } else {
-      notifyResult = await sendBoardingNotification({
-        parentWhatsapp: student.parent_whatsapp,
-        studentName: student.name,
-        busNumber: formattedBus,
-      });
-    }
-
-    let notificationStatus = notifyResult.method || 'none';
-    if (['boarding', 'return_boarding'].includes(scanType) && isDue) {
-      notificationStatus = `${notificationStatus}; fee_not_paid_alert`;
-      await sheets.logIncidentIfNew({
-        date: today,
-        student_id: student.student_id,
-        student_name: student.name,
-        bus_number: formattedBus,
-        driver_name: driverName,
-        incident_type: 'fee_defaulter',
-        details: 'Student boarded with fee status DUE',
-        timestamp: nowTimestamp(),
-      });
-    }
-
-    await sheets.updateNotificationStatus(student_id, today, scanType, notificationStatus);
-
-    res.json({
-      success: true,
-      scan_type: scanType,
-      student,
-      record,
-      notification: notifyResult,
-      feeAlert: ['boarding', 'return_boarding'].includes(scanType) && isDue,
-      feeAlertMessage: ['boarding', 'return_boarding'].includes(scanType) && isDue ? FEE_ALERT_MESSAGE : null,
-      isCrossBus,
-      crossBusNote: isCrossBus
-        ? `ℹ️ Note: ${student.name}'s regular bus is ${assignedBus}, boarding ${formattedBus} today`
-        : null,
-    });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/reception/scan', async (req, res) => {
-  try {
-    const { student_id } = req.body;
-    const student = await sheets.getStudentById(student_id);
-    if (!student) return res.status(404).json({ error: 'Student not found' });
-
-    const today = getISTDateString();
-    const formattedBus = formatBusNumber(student.bus_number);
-    const arrivalTime = formatISTTime();
-    const bus = await sheets.getBusByNumber(formattedBus);
-    const driverName = bus?.driver_name || 'Unknown';
-
-    const existingArrival = await sheets.findAttendanceRecord(
-      student_id,
-      formattedBus,
-      today,
-      'college_arrival'
-    );
-
-    if (existingArrival) {
-      await sheets.appendIncident({
-        date: today,
-        student_id: student.student_id,
-        student_name: student.name,
-        bus_number: formattedBus,
-        driver_name: driverName,
-        incident_type: 'duplicate_scan',
-        details: 'Duplicate college_arrival scan at reception',
-        timestamp: nowTimestamp(),
-      });
-      return res.json({
-        success: true,
-        duplicate: true,
-        student,
-        message: `⚠️ ${student.name} has already been scanned at college today`,
-      });
-    }
-
-    const driverScan = await sheets.hasDriverScanToday(student_id, today);
-    const missedScan = !driverScan;
-
-    let notificationStatus = 'college_arrival';
-    if (missedScan) notificationStatus += '; missed_driver_scan';
-
-    const boardingBus = driverScan
-      ? formatBusNumber(driverScan.actual_bus || driverScan.bus_number)
-      : formattedBus;
-    const isCrossBus =
-      !!driverScan &&
-      String(driverScan.is_cross_bus).toUpperCase() === 'TRUE';
-
-    const record = {
-      timestamp: nowTimestamp(),
-      student_id: student.student_id,
-      student_name: student.name,
-      bus_number: formattedBus,
-      stop_name: student.stop_name,
-      boarded_at: driverScan?.boarded_at || '',
-      driver_name: driverScan?.driver_name || driverName,
-      date: today,
-      notification_status: notificationStatus,
-      scan_type: 'college_arrival',
-      dropoff_time: '',
-      scanned_by: 'reception',
-      arrival_time: arrivalTime,
-    };
-
-    await sheets.appendAttendance(record);
-
-    await sendCollegeArrivalNotification({
-      parentWhatsapp: student.parent_whatsapp,
-      studentName: student.name,
-      busNumber: boardingBus,
-      withBus: !missedScan,
-    });
-
-    if (missedScan) {
-      await sheets.appendIncident({
-        date: today,
-        student_id: student.student_id,
-        student_name: student.name,
-        bus_number: formattedBus,
-        driver_name: driverName,
-        incident_type: 'missed_driver_scan',
-        details: 'Student arrived at college without driver boarding scan',
-        timestamp: nowTimestamp(),
-      });
-      await sendAdminMissedScanAlert({
-        studentName: student.name,
-        busNumber: formattedBus,
-        driverName,
-      });
-    }
-
-    res.json({
-      success: true,
-      scan_type: 'college_arrival',
-      student,
-      missedScan,
-      driverScanned: !!driverScan,
-      isCrossBus,
-      boardingBus,
-      message: missedScan
-        ? `⚠️ WARNING: ${student.name} arrived at college BUT was NOT scanned by driver of ${formattedBus} today. Please check with the driver immediately.`
-        : isCrossBus
-          ? `✅ ${student.name} arrived at college (boarded ${boardingBus} today, usual bus ${formattedBus})`
-          : `✅ ${student.name} arrived at college via ${boardingBus}`,
-    });
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
-});
-
-app.post('/api/admin/login', loginLimiter, async (req, res) => {
-  const { password } = req.body;
-  if (await verifyCredential(password, await getAdminPassword())) {
-    return res.json({ success: true });
-  }
-  res.status(401).json({ error: 'Invalid Admin Password' });
-});
-
-app.get('/api/admin/credentials', async (req, res) => {
-  const { password } = req.query;
-  if (!(await verifyCredential(password, await getAdminPassword()))) return res.status(401).json({ error: 'Unauthorized' });
-  
-  res.json((await getAllCredentials()));
-});
-
-app.post('/api/admin/credentials', async (req, res) => {
-  const { password, type, key, value } = req.body;
-  if (!(await verifyCredential(password, await getAdminPassword()))) return res.status(401).json({ error: 'Unauthorized' });
-  
-  try {
-    if (type === 'driverPin' && (!value || !/^\d{4}$/.test(value))) {
-      return res.status(400).json({ error: 'Driver PIN must be exactly 4 digits' });
-    }
-    if (type === 'receptionPin' && (!value || !/^\d{4}$/.test(value))) {
-      return res.status(400).json({ error: 'Reception PIN must be exactly 4 digits' });
-    }
-    if (type === 'adminPassword' && (!value || value.length < 6)) {
-      return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
-    }
-
+    await sheets.appendAuditLog('fee_updated', studentId, finalDueDate);
+    console.log(`[Fee Update] Successfully updated Google Sheets for ${studentId}.`);
+    
+    res.json({ success: true, fee_paid_until: finalDueDate });
+  } catch (err) {
+    console.error(`[Fee Update Error] for ${req.params.id}:`, err);
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.put('/api/students/:id/bus', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+
+    const studentId = req.params.id;
+    const { bus_number } = req.body;
+    
+    if (!bus_number) {
+      return res.status(400).json({ error: 'bus_number is required' });
+    }
+
+    await sheets.updateStudentBusNumber(studentId, bus_number);
+    console.log(`[Bus Update] Successfully updated bus for ${studentId} to ${bus_number}.`);
+
+    res.json({ success: true, bus_number });
+  } catch (err) {
+    console.error(`[Bus Update Error] for ${req.params.id}:`, err);
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.put('/api/students/bulk-fee', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+
+    const { student_ids, fee_paid_until } = req.body;
+    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
+      return res.status(400).json({ error: 'student_ids must be a non-empty array' });
+    }
+    if (!fee_paid_until) {
+      return res.status(400).json({ error: 'fee_paid_until is required' });
+    }
+
+    console.log(`[Bulk Fee Update] Request received for ${student_ids.length} students. Date: ${fee_paid_until}`);
+    await sheets.bulkUpdateFeePaidUntil(student_ids, fee_paid_until);
+    await sheets.appendAuditLog('fee_updated_bulk', `Count: ${student_ids.length}`, fee_paid_until);
+    console.log(`[Bulk Fee Update] Successfully updated ${student_ids.length} students.`);
+
+    res.json({ success: true, count: student_ids.length, fee_paid_until });
+  } catch (err) {
+    console.error(`[Bulk Fee Update Error]:`, err);
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/dashboard', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+    res.json(await sheets.getDashboardStats());
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.get('/api/reassignments/active', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+    const active = await reassignments.getActiveReassignments();
+    res.json(active);
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/reassignments', async (req, res) => {
+  try {
+    const password = req.headers['x-admin-password'];
+    if (!(await verifyCredential(password, await getAdminPassword()))) {
+      return res.status(401).json({ error: 'Unauthorized' });
+    }
+
+    const {
+      bus_number,
+      temp_driver,
+      temp_driver_phone,
+      temp_driver_bus,
+      reason,
+      end_date,
+      is_temporary = true,
+    } = req.body;
+
+    if (!bus_number || !temp_driver) {
+      return res.status(400).json({ error: 'bus_number and temp_driver are required' });
+    }
+
+    let resolvedTempDriverBus = temp_driver_bus;
+    if (!resolvedTempDriverBus) {
+      const buses = await sheets.getBuses();
+      resolvedTempDriverBus = await reassignments.findDriverHomeBus(temp_driver, buses);
+    }
+
+    const result = await reassignments.createReassignment({
+      bus_number,
+      temp_driver,
+      temp_driver_phone,
+      temp_driver_bus: resolvedTempDriverBus,
+      reason,
+      reassigned_by: 'admin',
+      end_date: end_date || getISTDateString(),
+      is_temporary: is_temporary !== false && is_temporary !== 'no',
+    });
+
+    res.json({ success: true, ...result });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/notify', async (req, res) => {
+  try {
+    const { student_id, bus_number, stop_name, scan_type } = req.body;
+    const student = await sheets.getStudentById(student_id);
+    if (!student) return res.status(404).json({ error: 'Student not found' });
+
+    const result = await sendWhatsAppNotification({
+      parentWhatsapp: student.parent_whatsapp,
+      studentName: student.name,
+      busNumber: bus_number || student.bus_number,
+      stopName: stop_name || student.stop_name,
+      scanType: scan_type || getScanType(),
+    });
+
+    await sheets.updateNotificationStatus(
+      student_id,
+      getISTDateString(),
+      scan_type || getScanType(),
+      result.method
+    );
+
+    res.json(result);
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+async function logDuplicateIncident(student, bus, driverName, scanType) {
+  await sheets.appendIncident({
+    date: getISTDateString(),
+    student_id: student.student_id,
+    student_name: student.name,
+    bus_number: bus,
+    driver_name: driverName,
+    incident_type: 'duplicate_scan',
+    details: `Duplicate ${scanType} scan attempted`,
+    timestamp: nowTimestamp(),
+  });
+}
+
+app.post('/api/scan', async (req, res) => {
+  try {
+    const { student_id, driver_name, bus_number, stop_name } = req.body;
+    const student = await sheets.getStudentById(student_id);
+    if (!student) return res.status(404).json({ error: 'Student not found' });
+
+    const today = getISTDateString();
+    const formattedBus = formatBusNumber(bus_number || student.bus_number);
+    const bus = await sheets.getBusByNumber(formattedBus);
+    const scanType = getDriverScanType(bus);
+    const scanTime = formatISTTime();
+    const driverName = driver_name || bus?.driver_name || 'Driver';
+
+    const existing = await sheets.findAttendanceRecord(
+      student_id,
+      formattedBus,
+      today,
+      scanType
+    );
+
+    if (existing) {
+      await logDuplicateIncident(student, formattedBus, driverName, scanType);
+      const action =
+        scanType === 'dropoff' ? 'dropped off' :
+        scanType === 'return_boarding' ? 'scanned for return' : 'scanned';
+      return res.json({
+        success: true,
+        duplicate: true,
+        scan_type: scanType,
+        student,
+        message: `⚠️ ${student.name} has already been ${action} today on ${formattedBus}`,
+      });
+    }
+
+    const isDue = isFeeDue(student, today);
+    const assignedBus = formatBusNumber(student.bus_number);
+    const isCrossBus =
+      ['boarding', 'return_boarding'].includes(scanType) &&
+      !busesMatch(assignedBus, formattedBus);
+
+    const record = {
+      timestamp: nowTimestamp(),
+      student_id: student.student_id,
+      student_name: student.name,
+      bus_number: formattedBus,
+      stop_name: stop_name || student.stop_name,
+      boarded_at: ['boarding', 'return_boarding'].includes(scanType) ? scanTime : '',
+      driver_name: driverName,
+      date: today,
+      notification_status: 'pending',
+      scan_type: scanType,
+      dropoff_time: scanType === 'dropoff' ? scanTime : '',
+      scanned_by: 'driver',
+      arrival_time: '',
+      is_cross_bus: isCrossBus,
+      actual_bus: isCrossBus ? formattedBus : '',
+      assigned_bus: isCrossBus ? assignedBus : '',
+    };
+
+    await sheets.appendAttendance(record);
+
+    let notifyResult;
+    if (scanType === 'dropoff') {
+      notifyResult = await sendDropoffNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        studentName: student.name,
+        busNumber: formattedBus,
+        stopName: record.stop_name,
+      });
+    } else if (scanType === 'return_boarding') {
+      notifyResult = isCrossBus
+        ? await sendCrossBusReturnBoardingNotification({
+            parentWhatsapp: student.parent_whatsapp,
+            studentName: student.name,
+            actualBus: formattedBus,
+            assignedBus,
+          })
+        : await sendReturnBoardingNotification({
+            parentWhatsapp: student.parent_whatsapp,
+            studentName: student.name,
+            busNumber: formattedBus,
+          });
+    } else if (isCrossBus) {
+      notifyResult = await sendCrossBusBoardingNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        studentName: student.name,
+        actualBus: formattedBus,
+        assignedBus,
+      });
+    } else {
+      notifyResult = await sendBoardingNotification({
+        parentWhatsapp: student.parent_whatsapp,
+        studentName: student.name,
+        busNumber: formattedBus,
+      });
+    }
+
+    let notificationStatus = notifyResult.method || 'none';
+    if (['boarding', 'return_boarding'].includes(scanType) && isDue) {
+      notificationStatus = `${notificationStatus}; fee_not_paid_alert`;
+      await sheets.logIncidentIfNew({
+        date: today,
+        student_id: student.student_id,
+        student_name: student.name,
+        bus_number: formattedBus,
+        driver_name: driverName,
+        incident_type: 'fee_defaulter',
+        details: 'Student boarded with fee status DUE',
+        timestamp: nowTimestamp(),
+      });
+    }
+
+    await sheets.updateNotificationStatus(student_id, today, scanType, notificationStatus);
+
+    res.json({
+      success: true,
+      scan_type: scanType,
+      student,
+      record,
+      notification: notifyResult,
+      feeAlert: ['boarding', 'return_boarding'].includes(scanType) && isDue,
+      feeAlertMessage: ['boarding', 'return_boarding'].includes(scanType) && isDue ? FEE_ALERT_MESSAGE : null,
+      isCrossBus,
+      crossBusNote: isCrossBus
+        ? `ℹ️ Note: ${student.name}'s regular bus is ${assignedBus}, boarding ${formattedBus} today`
+        : null,
+    });
+  } catch (err) {
+    res.status(500).json({ error: err.message });
+  }
+});
+
+app.post('/api/reception/scan', async (req, res) => {
+  try {
+    const { student_id } = req.body;
+    const student = await sheets.getStudentById(student_id);
+    if (!student) return res.status(404).json({ error: 'Student not found' });
+
+    const today = getISTDateString();
+    const formattedBus = formatBusNumber(student.bus_number);
+    const arrivalTime = formatISTTime();
+    const bus = await sheets.getBusByNumber(formattedBus);
+    const driverName = bus?.driver_name || 'Unknown';
+
+    const existingArrival = aw
<truncated 5292 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.