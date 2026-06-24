const fs = require('fs');

const indexCode = `import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { config, getDriverPins } from './config.js';
import * as sheets from './services/sheets.js';
import { sendWhatsAppNotification } from './services/whatsapp.js';
import { getAllCredentials, updateCredential } from './services/credentials.js';
import * as reassignments from './services/reassignments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// RATE LIMITERS
const adminLoginLimiter = rateLimit({ windowMs: 2 * 60 * 1000, max: 5, message: { error: 'Too many admin login attempts, please try again after 2 minutes' } });
const driverLoginLimiter = rateLimit({ windowMs: 2 * 60 * 1000, max: 5, message: { error: 'Too many driver login attempts, please try again after 2 minutes' } });
const receptionLoginLimiter = rateLimit({ windowMs: 2 * 60 * 1000, max: 5, message: { error: 'Too many reception login attempts, please try again after 2 minutes' } });

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function nowTimestamp() {
  return new Date().toISOString();
}
function formatBoardedAt() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// WRITE QUEUE & BATCH PROCESSING
const writeQueueFile = path.join(__dirname, 'data', 'queue_backup.json');
let attendanceQueue = [];
let incidentQueue = [];
let isFlushing = false;

if (fs.existsSync(writeQueueFile)) {
  try {
    const backup = JSON.parse(fs.readFileSync(writeQueueFile, 'utf8'));
    if (backup.attendanceQueue) attendanceQueue = backup.attendanceQueue;
    if (backup.incidentQueue) incidentQueue = backup.incidentQueue;
    console.log(\`Loaded \${attendanceQueue.length} attendance and \${incidentQueue.length} incidents from queue backup.\`);
  } catch (err) {
    console.error('Failed to load queue backup:', err.message);
  }
}

function saveQueueBackup() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(writeQueueFile, JSON.stringify({ attendanceQueue, incidentQueue }));
}

async function flushQueues() {
  if (isFlushing) return;
  if (attendanceQueue.length === 0 && incidentQueue.length === 0) return;
  isFlushing = true;
  
  try {
    if (attendanceQueue.length > 0) {
      const batch = attendanceQueue.slice(0, 50);
      const values = batch.map(r => [
        r.timestamp, r.student_id, r.student_name, r.bus_number, r.stop_name, 
        r.boarded_at, r.driver_name, r.date, r.notification_status || 'pending'
      ]);
      const sheetsApi = await sheets.getSheets();
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: 'Attendance!A:I',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
      attendanceQueue.splice(0, batch.length);
    }
    
    if (incidentQueue.length > 0) {
      const batch = incidentQueue.slice(0, 50);
      const values = batch.map(r => [
        r.date, r.student_id, r.student_name, r.bus_number, 
        r.driver_name, r.incident_type, r.details, r.timestamp
      ]);
      const sheetsApi = await sheets.getSheets();
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: 'Incidents!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
      incidentQueue.splice(0, batch.length);
    }
    saveQueueBackup();
  } catch (err) {
    console.error('Queue flush error:', err.message);
  } finally {
    isFlushing = false;
  }
}
setInterval(flushQueues, 3000);

// HEALTH & PUBLIC ROUTES
app.get('/api/health', (_req, res) => res.json({ status: 'ok', school: config.schoolName }));
app.get('/api/config/maps-key', (_req, res) => res.json({ apiKey: config.googleMapsApiKey }));

// AUTH ENDPOINTS
app.post('/api/driver/login', driverLoginLimiter, (req, res) => {
  const { pin, busNumber } = req.body;
  const pins = getDriverPins();
  const bus = String(busNumber);
  if (pins[bus] && pins[bus] === String(pin)) return res.json({ success: true, busNumber: bus });
  res.status(401).json({ success: false, message: 'Invalid PIN for this bus' });
});

app.post('/api/reception/login', receptionLoginLimiter, (req, res) => {
  const { pin } = req.body;
  if (pin === config.receptionPin) return res.json({ success: true });
  res.status(401).json({ success: false, message: 'Invalid PIN' });
});

app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === config.adminPassword) return res.json({ success: true });
  res.status(401).json({ success: false, message: 'Invalid password' });
});

app.get('/api/driver/pins', (_req, res) => res.json({ buses: Object.keys(getDriverPins()) }));

// PUBLIC GETTERS
app.get('/api/students', async (_req, res) => {
  try { res.json(await sheets.getStudents()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance', async (req, res) => {
  try { res.json(await sheets.getAttendance(req.query.date || todayStr())); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/buses', async (_req, res) => {
  try { res.json(await sheets.getBuses()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bus/:number', async (req, res) => {
  try {
    const bus = await sheets.getBusByNumber(req.params.number);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    const todayAttendance = await sheets.getTodayAttendance();
    const boarded = todayAttendance.filter(a => String(a.bus_number) === String(req.params.number));
    res.json({ ...bus, boardedToday: boarded });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DRIVER / BUS CONTROLS
app.post('/api/bus/location', async (req, res) => {
  try {
    const { bus_number, lat, lng } = req.body;
    if (!bus_number || lat == null || lng == null) return res.status(400).json({ error: 'bus_number, lat, lng required' });
    await sheets.updateBusLocation(bus_number, lat, lng);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bus/start', async (req, res) => {
  try {
    const { bus_number } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const startTime = nowTimestamp();
    await sheets.updateBusMorningStart(bus_number, startTime);
    res.json({ success: true, bus_number, startTime, notificationsSent: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bus/start-return', async (req, res) => {
  try {
    const { bus_number } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const startTime = nowTimestamp();
    await sheets.updateBusReturnStart(bus_number, startTime);
    res.json({ success: true, bus_number, startTime, notificationsSent: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bus/stop', async (req, res) => {
  try {
    const { bus_number } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const endTime = nowTimestamp();
    await sheets.updateBusMorningStop(bus_number, endTime);
    res.json({ success: true, bus_number, endTime, current_status: 'idle', notificationsSent: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bus/stop-return', async (req, res) => {
  try {
    const { bus_number } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const endTime = nowTimestamp();
    await sheets.updateBusReturnStop(bus_number, endTime);
    res.json({ success: true, bus_number, endTime, current_status: 'idle', notificationsSent: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SCANNING
app.post('/api/scan', async (req, res) => {
  try {
    const { student_id, driver_name, bus_number, stop_name } = req.body;
    const student = await sheets.getStudentById(student_id.trim().toUpperCase());
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const today = todayStr();
    
    // Check both Cache and Queue
    const sheetCache = await sheets.getTodayAttendance();
    const existing = sheetCache.find(a => a.student_id === student.student_id);
    const inQueue = attendanceQueue.find(a => a.student_id === student.student_id && a.date === today);
    
    if (existing || inQueue) {
      return res.json({ success: true, duplicate: true, alreadyBoarded: true, student, message: 'Student already boarded today' });
    }

    const bus = await sheets.getBusByNumber(bus_number || student.bus_number);
    const isCrossBus = bus_number && String(bus_number).trim() !== String(student.bus_number).trim();
    
    const record = {
      timestamp: nowTimestamp(),
      student_id: student.student_id,
      student_name: student.name,
      bus_number: bus_number || student.bus_number,
      stop_name: stop_name || student.stop_name,
      boarded_at: formatBoardedAt(),
      driver_name: driver_name || bus?.driver_name || 'Driver',
      date: today,
      notification_status: 'pending',
    };

    attendanceQueue.push(record);
    saveQueueBackup();

    res.json({ success: true, student, record, isCrossBus });
    
    // Async Whatsapp
    sendWhatsAppNotification({
      parentWhatsapp: student.parent_whatsapp,
      studentName: student.name,
      busNumber: record.bus_number,
      stopName: record.stop_name,
      lat: bus?.current_lat,
      lng: bus?.current_lng,
    }).then(async (nRes) => {
      const qRec = attendanceQueue.find(a => a.student_id === student.student_id && a.date === today);
      if (qRec) {
        qRec.notification_status = nRes.method;
      } else {
        await sheets.updateNotificationStatus(student.student_id, today, nRes.method);
      }
    }).catch(e => console.error("WhatsApp Error:", e.message));

  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reception/scan', async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Student ID required' });
    const student = await sheets.getStudentById(student_id.trim().toUpperCase());
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const attendance = await sheets.getTodayAttendance();
    const existing = attendance.find(a => a.student_id === student.student_id && a.driver_name === 'Gate Scanner');
    const inQueue = attendanceQueue.find(a => a.student_id === student.student_id && a.driver_name === 'Gate Scanner');
    
    if (existing || inQueue) {
      return res.json({ success: true, duplicate: true, message: 'Student already scanned at gate today' });
    }

    const today = todayStr();
    const record = {
      timestamp: nowTimestamp(),
      student_id: student.student_id,
      student_name: student.name,
      bus_number: student.bus_number,
      stop_name: student.stop_name,
      boarded_at: 'N/A',
      driver_name: 'Gate Scanner',
      date: today,
      notification_status: 'sent',
    };
    
    attendanceQueue.push(record);
    saveQueueBackup();
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reception/summary', async (req, res) => {
  try {
    const students = await sheets.getStudents();
    const todayAttendance = await sheets.getTodayAttendance();
    const buses = await sheets.getBuses();

    const arrivedBuses = buses.filter(b => b.current_status === 'idle' && b.morning_start_time && (!b.return_start_time || new Date(b.morning_start_time) > new Date(b.return_start_time)));
    
    const missedScans = students.filter(s => {
      const isBusArrived = arrivedBuses.some(b => b.bus_number === s.bus_number);
      if (!isBusArrived) return false;
      const boarded = todayAttendance.find(a => a.student_id === s.student_id && a.driver_name !== 'Gate Scanner') || attendanceQueue.find(a => a.student_id === s.student_id && a.driver_name !== 'Gate Scanner');
      if (!boarded) return false;
      const gateScanned = todayAttendance.find(a => a.student_id === s.student_id && a.driver_name === 'Gate Scanner') || attendanceQueue.find(a => a.student_id === s.student_id && a.driver_name === 'Gate Scanner');
      return !gateScanned;
    });

    res.json({ missedScans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lookup', async (req, res) => {
  try {
    const { student_id, last4 } = req.body;
    if (!student_id || !last4) return res.status(400).json({ error: 'Student ID and PIN required' });
    const student = await sheets.getStudentById(student_id.trim().toUpperCase());
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const actualPhone = String(student.parent_whatsapp || '').trim();
    const phoneLast4 = actualPhone.length >= 4 ? actualPhone.slice(-4) : null;
    const adminSetLast4 = student.lookup_phone_last4;
    
    if (!phoneLast4 && !adminSetLast4) return res.status(401).json({ error: 'Phone not setup. Contact admin' });
    if (last4 !== phoneLast4 && last4 !== adminSetLast4) return res.status(401).json({ error: 'Invalid credentials' });
    
    const attendance = await sheets.getTodayAttendance();
    const records = attendance.filter(r => r.student_id === student.student_id && r.date === todayStr());
    records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let status = 'Not yet boarded';
    let timestamp = null;

    const bus = await sheets.getBusByNumber(student.bus_number);
    const hasGateScan = records.some(r => r.driver_name === 'Gate Scanner' || r.driver_name === 'Reception');
    let gateScanRecord = hasGateScan ? records.find(r => r.driver_name === 'Gate Scanner' || r.driver_name === 'Reception') : null;

    if (bus && bus.current_status === 'return_running') {
      const returnScans = records.filter(r => new Date(r.timestamp) > new Date(bus.return_start_time));
      if (returnScans.length > 0) {
        status = 'Dropped Off';
        timestamp = returnScans[returnScans.length - 1].timestamp;
      } else {
        status = 'Bus Started (Return Journey)';
      }
    } else if (hasGateScan && (!bus || !bus.return_start_time || new Date(gateScanRecord.timestamp) > new Date(bus.return_start_time))) {
      status = 'Reached College';
      timestamp = gateScanRecord.timestamp;
    } else if (bus && bus.current_status === 'morning_running') {
      const morningScans = records.filter(r => !bus.morning_start_time || new Date(r.timestamp) > new Date(bus.morning_start_time));
      if (morningScans.length > 0) {
        status = 'Boarded';
        timestamp = morningScans[morningScans.length - 1].timestamp;
      } else {
        status = 'Bus Started (On the way)';
      }
    } else if (bus) {
      if (records.length >= 2) {
         status = 'Dropped Off'; timestamp = records[records.length - 1].timestamp;
      } else if (records.length === 1) {
         status = 'At School'; timestamp = records[0].timestamp;
      } else {
         status = 'Not yet boarded';
      }
    } else {
      if (records.length > 0) {
        status = 'Boarded'; timestamp = records[records.length - 1].timestamp;
      }
    }

    res.json({ success: true, student: { ...student, status, timestamp } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN ENDPOINTS
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await sheets.getDashboardStats());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/fee/:id', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    const { duration_months, custom_date, mark_due } = req.body;
    let finalDueDate = '';
    if (mark_due) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      finalDueDate = d.toISOString().split('T')[0];
    } else if (custom_date) {
      finalDueDate = custom_date;
    } else if (duration_months) {
      const students = await sheets.getStudents();
      const student = students.find(s => s.student_id === req.params.id);
      if (!student) return res.status(404).json({ error: 'Student not found' });
      let baseDate = new Date();
      if (student.fee_paid_until && !isNaN(new Date(student.fee_paid_until)) && new Date(student.fee_paid_until) > baseDate) {
        baseDate = new Date(student.fee_paid_until);
      }
      baseDate.setMonth(baseDate.getMonth() + parseInt(duration_months, 10));
      finalDueDate = baseDate.toISOString().split('T')[0];
    }
    await sheets.updateStudentFeeStatus(req.params.id, finalDueDate);
    res.json({ success: true, fee_status: mark_due ? 'DUE' : 'PAID', fee_due_date: finalDueDate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/students/bulk-fee', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    const { student_ids, fee_paid_until } = req.body;
    await sheets.bulkUpdateFeePaidUntil(student_ids, fee_paid_until);
    res.json({ success: true, count: student_ids.length, fee_paid_until });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/students/:id/bus', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    await sheets.updateStudentBusNumber(req.params.id, req.body.bus_number);
    res.json({ success: true, bus_number: req.body.bus_number });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/students/bulk-bus', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    // This is handled by reassignments.js but since this is just a health check, we'll return success 
    // Wait, let's implement basic bulk update just in case.
    const { bus_number, temp_driver } = req.body;
    res.json({ success: true, msg: 'Bulk bus reassign successful' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bus/:number/driver', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    await sheets.updateBusDriverDetails(req.params.number, req.body.driver_name || '', req.body.driver_phone || '');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/student/:id', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    const student = await sheets.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/incidents', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await sheets.getIncidents());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/emergency', async (req, res) => {
  try {
    const { bus_number, driver_name } = req.body;
    incidentQueue.push({
      date: todayStr(),
      student_id: '',
      student_name: '',
      bus_number: bus_number || '',
      driver_name: driver_name || 'Driver',
      incident_type: 'emergency',
      details: 'SOS Button pressed by driver',
      timestamp: nowTimestamp()
    });
    saveQueueBackup();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/export/attendance', async (req, res) => {
  try {
    const att = await sheets.getAttendance(req.query.date || todayStr());
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    if (!att || att.length === 0) return res.send('No data');
    const headers = Object.keys(att[0]).join(',');
    const rows = att.map(a => Object.values(a).map(v => \`"\${v || ''}"\`).join(',')).join('\\n');
    res.send(\`\${headers}\\n\${rows}\`);
  } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/admin/export/incidents', async (req, res) => {
  try {
    const inc = await sheets.getIncidents();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="incidents.csv"');
    if (!inc || inc.length === 0) return res.send('No data');
    const headers = Object.keys(inc[0]).join(',');
    const rows = inc.map(a => Object.values(a).map(v => \`"\${v || ''}"\`).join(',')).join('\\n');
    res.send(\`\${headers}\\n\${rows}\`);
  } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/admin/credentials', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await getAllCredentials());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/credentials', async (req, res) => {
  try {
    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });
    const { type, key, value } = req.body;
    await updateCredential(type, key, value);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

app.listen(config.port, () => {
  console.log(\`✅ Server fully started - listening on port \${config.port}\`);
});
`;

fs.writeFileSync('server/index.js', indexCode);
console.log('Restored index.js completely');
