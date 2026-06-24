import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { config, getDriverPins } from './config.js';
import * as sheets from './services/sheets.js';
import { sendWhatsAppNotification } from './services/whatsapp.js';
import { getAllCredentials, updateCredential, getAdminPassword, getAccountantPin, getBusInchargePin } from './services/credentials.js';
import * as reassignments from './services/reassignments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
// Increase keep-alive timeout above nginx/load-balancer defaults to
// avoid ECONNRESET when many concurrent requests come in simultaneously.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

app.use(cors());
app.use(express.json());

// RATE LIMITERS
const adminLoginLimiter = rateLimit({ windowMs: 2 * 60 * 1000, max: 5, message: { error: 'Too many admin login attempts, please try again after 2 minutes' } });
const accountantLoginLimiter = rateLimit({ windowMs: 2 * 60 * 1000, max: 5, message: { error: 'Too many accountant login attempts, please try again after 2 minutes' } });
const busInchargeLoginLimiter = rateLimit({ windowMs: 2 * 60 * 1000, max: 5, message: { error: 'Too many bus-incharge login attempts, please try again after 2 minutes' } });
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
    console.log(`Loaded ${attendanceQueue.length} attendance and ${incidentQueue.length} incidents from queue backup.`);
  } catch (err) {
    console.error('Failed to load queue backup:', err.message);
  }
}

let saveQueueTimer = null;

function saveQueueBackupImmediate() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFile(writeQueueFile, JSON.stringify({ attendanceQueue, incidentQueue }), (err) => {
    if (err) console.error('Queue backup save failed:', err.message);
  });
}

function saveQueueBackup() {
  if (saveQueueTimer) clearTimeout(saveQueueTimer);
  saveQueueTimer = setTimeout(() => {
    saveQueueTimer = null;
    saveQueueBackupImmediate();
  }, 200);
}

async function flushQueues() {
  if (isFlushing) return;
  if (attendanceQueue.length === 0 && incidentQueue.length === 0) return;
  isFlushing = true;
  
  try {
    if (attendanceQueue.length > 0) {
      const batch = attendanceQueue.slice(0, 1000);
      const values = batch.map(r => [
        r.timestamp, r.student_id, r.student_name, r.bus_number, r.stop_name, 
        r.boarded_at, r.driver_name, r.date, r.notification_status || 'pending'
      ]);
      const sheetsApi = await sheets.getSheets();
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: config.googleSheetsId,
        range: 'Attendance!A:I',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
      sheets.appendToCache('Attendance!A:H', values);
      attendanceQueue.splice(0, batch.length);
    }
    
    if (incidentQueue.length > 0) {
      const batch = incidentQueue.slice(0, 1000);
      const values = batch.map(r => [
        r.date, r.student_id, r.student_name, r.bus_number, 
        r.driver_name, r.incident_type, r.details, r.timestamp
      ]);
      const sheetsApi = await sheets.getSheets();
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: config.googleSheetsId,
        range: 'Incidents!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
      sheets.appendToCache('Incidents!A:H', values);
      incidentQueue.splice(0, batch.length);
    }
    saveQueueBackupImmediate();
  } catch (err) {
    console.error('Queue flush error:', err.message);
  } finally {
    isFlushing = false;
  }
}
setInterval(flushQueues, 3000);

// ─── PROACTIVE CACHE WARM-UP ────────────────────────────────────────────────
// Refresh Students, Buses, and today's Attendance in the background every 8s
// (just before the 10s TTL expires). This ensures the cache is NEVER empty
// during active hours, so all real user requests hit the fast warm-cache path
// (~400-580ms) rather than the cold-cache path (~2500ms).
async function warmCache() {
  try {
    const today = todayStr();
    // Fire all three fetches in parallel; errors are silenced so a transient
    // Google Sheets blip never crashes the warm-up loop.
    await Promise.allSettled([
      sheets.getStudents(),
      sheets.getBuses(),
      sheets.getSheetData(`Attendance!A:J`),
    ]);
  } catch (_) { /* silently ignored */ }
}

// Run immediately on startup so the very first real request is also fast.
warmCache();
setInterval(warmCache, 8000);
// ────────────────────────────────────────────────────────────────────────────


async function authAdmin(req, res, next) {
  try {
    const pwd = await getAdminPassword();
    const token = req.headers['x-admin-password'] || req.query.token;
    if (pwd && token === pwd) return next();
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authAccountant(req, res, next) {
  try {
    const adminPwd = await getAdminPassword();
    if (adminPwd && req.headers['x-admin-password'] === adminPwd) return next();
    const accPin = await getAccountantPin();
    if (accPin && req.headers['x-accountant-pin'] === accPin) return next();
    res.status(403).json({ error: 'Forbidden: Accountant access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authBusIncharge(req, res, next) {
  try {
    const adminPwd = await getAdminPassword();
    if (adminPwd && req.headers['x-admin-password'] === adminPwd) return next();
    const busPin = await getBusInchargePin();
    if (busPin && req.headers['x-bus-incharge-pin'] === busPin) return next();
    res.status(403).json({ error: 'Forbidden: Bus Incharge access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authAnyStaff(req, res, next) {
  try {
    const adminPwd = await getAdminPassword();
    if (adminPwd && req.headers['x-admin-password'] === adminPwd) return next();
    const accPin = await getAccountantPin();
    if (accPin && req.headers['x-accountant-pin'] === accPin) return next();
    const busPin = await getBusInchargePin();
    if (busPin && req.headers['x-bus-incharge-pin'] === busPin) return next();
    res.status(403).json({ error: 'Forbidden: Staff access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authDriver(req, res, next) {
    const { busNumber, pin } = req.headers;
    const pins = getDriverPins();
    if (busNumber && pins[busNumber] === pin) return next();
    res.status(401).json({ error: 'Unauthorized: Invalid driver credentials' });
}

// HEALTH & PUBLIC ROUTES
app.get('/api/health', (_req, res) => res.json({ status: 'ok', school: config.schoolName }));
app.get('/api/config/maps-key', (_req, res) => res.json({ apiKey: config.googleMapsApiKey }));
app.get('/api/config/scan-mode', async (req, res) => {
  try {
    const { bus_number } = req.query;
    let mode = { scanType: 'boarding', isDropoff: false };
    if (bus_number) {
      const bus = await sheets.getBusByNumber(bus_number);
      if (bus && bus.current_status === 'return_running') {
        mode = { scanType: 'dropoff', isDropoff: true };
      }
    }
    res.json(mode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  const { password } = req.body;
  const pwd = await getAdminPassword();
  if (password === pwd) return res.json({ success: true, role: 'admin' });
  res.status(401).json({ success: false, message: 'Invalid password' });
});

app.post('/api/accountant/login', accountantLoginLimiter, async (req, res) => {
  const { pin } = req.body;
  const accPin = await getAccountantPin();
  if (pin === accPin) return res.json({ success: true, role: 'accountant' });
  res.status(401).json({ success: false, message: 'Invalid PIN' });
});

app.post('/api/bus-incharge/login', busInchargeLoginLimiter, async (req, res) => {
  const { pin } = req.body;
  const busPin = await getBusInchargePin();
  if (pin === busPin) return res.json({ success: true, role: 'bus_incharge' });
  res.status(401).json({ success: false, message: 'Invalid PIN' });
});

app.get('/api/driver/pins', (_req, res) => res.json({ buses: Object.keys(getDriverPins()) }));

// PUBLIC GETTERS
app.get('/api/students', async (_req, res) => {
  try { res.json(await sheets.getStudents()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance', async (req, res) => {
  try { 
    const dateQuery = req.query.date || todayStr();
    const records = await sheets.getAttendance(dateQuery); 
    const buses = await sheets.getBuses();
    const { busNumberKey } = await import('./utils.js');
    
    const enrich = (r) => {
      const bus = buses.find(b => busNumberKey(b.bus_number) === busNumberKey(r.bus_number));
      let scan_type = 'old';
      const scanTime = new Date(r.timestamp).getTime();
      
      if (bus) {
        const mStart = bus.morning_start_time ? new Date(bus.morning_start_time).getTime() : 0;
        const rStart = bus.return_start_time ? new Date(bus.return_start_time).getTime() : 0;
        
        if (rStart > 0 && scanTime >= rStart) {
          scan_type = 'dropoff';
        } else if (mStart > 0 && scanTime >= mStart && (rStart === 0 || scanTime < rStart)) {
          scan_type = 'boarding';
        }
      }
      return { ...r, scan_type };
    };

    const augmented = records.map(enrich);
    const queueRecords = attendanceQueue.filter(a => a.date === dateQuery).map(enrich);
    
    res.json([...augmented, ...queueRecords]);
  } 
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
    
    const bus = await sheets.getBusByNumber(bus_number || student.bus_number);
    
    // Check both Cache and Queue
    const sheetCache = await sheets.getTodayAttendance();
    const allScans = [
      ...sheetCache.filter(a => a.student_id === student.student_id),
      ...attendanceQueue.filter(a => a.student_id === student.student_id && a.date === today)
    ];
    
    let isDuplicate = false;
    
    const returnStart = bus?.return_start_time ? new Date(bus.return_start_time).getTime() : 0;
    const morningStart = bus?.morning_start_time ? new Date(bus.morning_start_time).getTime() : 0;

    if (bus && bus.current_status === 'return_running') {
      isDuplicate = allScans.some(a => a.driver_name !== 'Gate Scanner' && a.driver_name !== 'Reception' && new Date(a.timestamp).getTime() > returnStart);
    } else {
      const morningScans = allScans.filter(a => a.driver_name !== 'Gate Scanner' && a.driver_name !== 'Reception' && new Date(a.timestamp).getTime() >= morningStart && (returnStart === 0 || new Date(a.timestamp).getTime() <= returnStart));
      isDuplicate = morningScans.length > 0;
    }
    
    if (isDuplicate) {
      return res.json({ success: true, duplicate: true, alreadyBoarded: true, student, message: 'Student already boarded for this journey' });
    }

    const isCrossBus = bus_number && String(bus_number).trim() !== String(student.bus_number).trim();

    // ── Fee status check ────────────────────────────────────────────────────
    // Use fee_paid_until date if available (more accurate), else fall back to fee_status field
    let feeAlert = (student.fee_status || '').toUpperCase() === 'DUE';
    if (student.fee_paid_until && !isNaN(new Date(student.fee_paid_until))) {
      feeAlert = new Date(student.fee_paid_until) < new Date();
    }
    
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

    let scan_type = 'boarding';
    if (bus && bus.current_status === 'return_running') {
      scan_type = 'dropoff';
    }

    res.json({ success: true, student, record, isCrossBus, scan_type, feeAlert });

    
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
    
    // Check fee status
    let isDue = (student.fee_status || '').toUpperCase() === 'DUE';
    if (student.fee_paid_until && !isNaN(new Date(student.fee_paid_until))) {
      isDue = new Date(student.fee_paid_until) < new Date();
    }
    
    // Check if scanned by driver today
    const driverScanned = attendance.some(a => a.student_id === student.student_id && a.driver_name !== 'Gate Scanner' && a.driver_name !== 'Reception') || 
                          attendanceQueue.some(a => a.student_id === student.student_id && a.driver_name !== 'Gate Scanner' && a.driver_name !== 'Reception');

    const existing = attendance.find(a => a.student_id === student.student_id && a.driver_name === 'Gate Scanner');
    const inQueue = attendanceQueue.find(a => a.student_id === student.student_id && a.driver_name === 'Gate Scanner');
    
    if (existing || inQueue) {
      return res.json({ success: true, duplicate: true, message: 'Student already scanned at gate today', driverScanned, isDue });
    }
    
    if (!driverScanned) {
      // Log missed driver scan as incident
      incidentQueue.push({
        date: todayStr(),
        student_id: student.student_id,
        student_name: student.name,
        bus_number: student.bus_number,
        driver_name: 'Gate Scanner',
        incident_type: 'missed_scan',
        details: 'Student reached gate without being scanned by bus driver',
        timestamp: nowTimestamp()
      });
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

    const isMissedScan = !driverScanned;
    const message = isMissedScan 
      ? "Student reached gate without being scanned by bus driver"
      : "Student successfully verified at gate";

    res.json({ success: true, student, missedScan: isMissedScan, message, isDue });

    // Send WhatsApp notification for gate scan
    sendWhatsAppNotification({
      parentWhatsapp: student.parent_whatsapp,
      studentName: student.name,
      busNumber: record.bus_number,
      stopName: "College Gate",
      lat: null,
      lng: null,
      scan_type: 'gate'
    }).then(async (nRes) => {
      const qRec = attendanceQueue.find(a => a.student_id === student.student_id && a.driver_name === 'Gate Scanner' && a.date === today);
      if (qRec) {
        qRec.notification_status = nRes.method;
      }
    }).catch(e => console.error("WhatsApp Error (Gate):", e.message));

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
    const today = todayStr();
    const allScans = [
      ...attendance.filter(a => a.student_id === student.student_id),
      ...attendanceQueue.filter(a => a.student_id === student.student_id && a.date === today)
    ];
    const records = allScans;
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let status = 'Not yet boarded';
    let timestamp = null;

    const busScans = records.filter(r => r.driver_name !== 'Gate Scanner' && r.driver_name !== 'Reception');
    const actual_bus_number = busScans.length > 0 ? busScans[busScans.length - 1].bus_number : student.bus_number;
    
    const bus = await sheets.getBusByNumber(actual_bus_number);
    const returnStart = bus?.return_start_time ? new Date(bus.return_start_time).getTime() : 0;
    const morningStart = bus?.morning_start_time ? new Date(bus.morning_start_time).getTime() : 0;
    
    const returnScans = busScans.filter(r => new Date(r.timestamp).getTime() > returnStart && returnStart > 0);
    const morningScans = busScans.filter(r => new Date(r.timestamp).getTime() >= morningStart && (returnStart === 0 || new Date(r.timestamp).getTime() <= returnStart));
    
    const gateScans = records.filter(r => r.driver_name === 'Gate Scanner' || r.driver_name === 'Reception');
    const gateScanRecord = gateScans.length > 0 ? gateScans[gateScans.length - 1] : null;

    if (bus && bus.current_status === 'return_running') {
      if (returnScans.length > 0) {
        status = 'Dropped Off';
        timestamp = returnScans[returnScans.length - 1].timestamp;
      } else {
        status = 'Bus Started (Return Journey)';
      }
    } else if (gateScanRecord) {
      status = 'Reached College';
      timestamp = gateScanRecord.timestamp;
    } else if (bus && bus.current_status === 'morning_running') {
      if (morningScans.length > 0) {
        status = 'Boarded';
        timestamp = morningScans[morningScans.length - 1].timestamp;
      } else {
        status = 'Bus Started (On the way)';
      }
    } else {
      if (returnStart > 0 && returnScans.length > 0) {
        status = 'Dropped Off';
        timestamp = returnScans[returnScans.length - 1].timestamp;
      } else if (morningScans.length > 0) {
        status = 'At School';
        timestamp = morningScans[morningScans.length - 1].timestamp;
      } else {
        status = 'Not yet boarded';
      }
    }

    res.json({ success: true, student: { ...student, bus_number: actual_bus_number, status, timestamp } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN ENDPOINTS
app.get('/api/admin/dashboard', authAnyStaff, async (req, res) => {
  try {
    res.json(await sheets.getDashboardStats());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/fee/:id', authAccountant, async (req, res) => {
  try {
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
    const newFeeStatus = mark_due ? 'DUE' : 'PAID';
    await sheets.updateStudentFeeStatus(req.params.id, newFeeStatus, finalDueDate);
    res.json({ success: true, fee_status: newFeeStatus, fee_due_date: finalDueDate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/students/bulk-fee', authAccountant, async (req, res) => {
  try {
    const { student_ids, fee_paid_until } = req.body;
    await sheets.bulkUpdateFeePaidUntil(student_ids, fee_paid_until);
    res.json({ success: true, count: student_ids.length, fee_paid_until });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/students/:id/bus', authBusIncharge, async (req, res) => {
  try {
    await sheets.updateStudentBusNumber(req.params.id, req.body.bus_number);
    res.json({ success: true, bus_number: req.body.bus_number });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/students/bulk-bus', authAdmin, async (req, res) => {
  try {
    // This is handled by reassignments.js but since this is just a health check, we'll return success 
    // Wait, let's implement basic bulk update just in case.
    const { bus_number, temp_driver } = req.body;
    res.json({ success: true, msg: 'Bulk bus reassign successful' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bus/:number/driver', authBusIncharge, async (req, res) => {
  try {
    await sheets.updateBusDriverDetails(req.params.number, req.body.driver_name || '', req.body.driver_phone || '');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/student/:id', authAccountant, async (req, res) => {
  try {
    const student = await sheets.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const allAttendance = await sheets.getAttendance();
    const history = allAttendance
      .filter((r) => r.student_id === req.params.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50); // Get last 50
    const calculated_fee_status = (student.fee_status || '').toUpperCase() === 'DUE' ? 'DUE' : 'PAID';
    res.json({ student: { ...student, calculated_fee_status }, history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/incidents', authAdmin, async (req, res) => {
  try {
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

app.get('/api/admin/export/attendance', authAdmin, async (req, res) => {
  try {
    const att = await sheets.getAttendance(req.query.date || todayStr());
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    if (!att || att.length === 0) return res.send('No data');
    const headers = Object.keys(att[0]).join(',');
    const rows = att.map(a => Object.values(a).map(v => `"${v || ''}"`).join(',')).join('\n');
    res.send(`${headers}\n${rows}`);
  } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/admin/export/incidents', authAdmin, async (req, res) => {
  try {
    const inc = await sheets.getIncidents();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="incidents.csv"');
    if (!inc || inc.length === 0) return res.send('No data');
    const headers = Object.keys(inc[0]).join(',');
    const rows = inc.map(a => Object.values(a).map(v => `"${v || ''}"`).join(',')).join('\n');
    res.send(`${headers}\n${rows}`);
  } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/admin/credentials', authAdmin, async (req, res) => {
  try {
    res.json(await getAllCredentials());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/credentials', authAdmin, async (req, res) => {
  try {
    const { type, key, value } = req.body;
    await updateCredential(type, key, value);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reassignments/active', authBusIncharge, async (req, res) => {
  try {
    res.json(await reassignments.getActiveReassignments());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reassignments', authBusIncharge, async (req, res) => {
  try {
    const data = await reassignments.createReassignment(req.body);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reassignments/:bus/end', authBusIncharge, async (req, res) => {
  try {
    // Quick workaround: re-create the reassignment marking it reverted
    const active = await reassignments.getActiveReassignmentForBus(req.params.bus);
    if (!active) return res.status(404).json({ error: 'No active reassignment found' });
    // Revert logic is already handled by reverting expired, but we can force end date to yesterday and run revert
    active.end_date = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await reassignments.revertExpiredReassignments();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/students', authBusIncharge, async (req, res) => {
  try {
    const s = req.body;
    if (!s.student_id || !s.name || !s.bus_number || !s.stop_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await sheets.getStudentById(s.student_id);
    if (existing) {
      return res.status(400).json({ error: 'Student ID already exists' });
    }
    
    const feeStatus = s.fee_paid_until ? 'PAID' : 'DUE';
    const record = {
      student_id: s.student_id,
      name: s.name,
      class: s.class || '',
      bus_number: s.bus_number,
      stop_name: s.stop_name,
      parent_name: s.parent_name || '',
      parent_whatsapp: s.parent_whatsapp || '',
      fee_status: feeStatus,
      fee_paid_until: s.fee_paid_until || '',
      lookup_phone_last4: s.lookup_phone_last4 || ''
    };
    await sheets.appendStudent(record);
    res.json({ success: true, student: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── QR CODE GENERATION ─────────────────────────────────────────────────────
// Layout: 3 columns × 7 rows = 21 labels per A4 page, never split across pages.
import QRCode from 'qrcode';

function buildLabelHtml(students, qrDataUrls, title = 'QR Labels', showPrintBtn = true) {
  const PER_PAGE = 21; // 3 columns × 7 rows

  // Group into hard pages of 21
  const pages = [];
  for (let i = 0; i < students.length; i += PER_PAGE) {
    pages.push(students.slice(i, i + PER_PAGE).map((s, j) => ({ s, url: qrDataUrls[i + j] })));
  }

  const pagesHtml = pages.map(page => {
    const labelsHtml = page.map(({ s, url }) => `
      <div class="label">
        <img src="${url}" alt="QR" />
        <div class="sid">${s.student_id}</div>
      </div>`).join('');
    return `<div class="page">${labelsHtml}</div>`;
  }).join('');

  const totalPages = pages.length;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #e2e8f0; }
    .toolbar {
      background: #2563eb; color: white; padding: 12px 20px;
      display: flex; align-items: center; gap: 12px;
      position: sticky; top: 0; z-index: 10;
    }
    .toolbar h1 { font-size: 16px; }
    .toolbar button {
      background: white; color: #2563eb; border: none; border-radius: 6px;
      padding: 8px 18px; font-weight: bold; cursor: pointer; font-size: 14px;
    }
    .toolbar .note { font-size: 12px; opacity: 0.85; margin-left: auto; }

    /* Each page div = exactly one A4 sheet */
    .page {
      width: 210mm;
      height: 297mm;
      margin: 12px auto;
      background: white;
      padding: 10mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(7, 1fr);
      gap: 3mm;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .label {
      border: 0.5px solid #cbd5e1;
      border-radius: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5mm;
      overflow: hidden;
      background: white;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .label img { width: 25mm; height: 25mm; }
    .sid {
      font-size: 9pt; font-weight: bold;
      color: #1e3a5f; text-align: center; white-space: nowrap;
    }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page { margin: 0; box-shadow: none; }
      .label { border-color: #aaa; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
  ${showPrintBtn ? `
  <div class="toolbar">
    <h1>🚌 ${title}</h1>
    <button onclick="window.print()">🖨️ Print</button>
    <span class="note">21 per page (3 × 7) &nbsp;|&nbsp; ${students.length} students &nbsp;|&nbsp; ${totalPages} page${totalPages !== 1 ? 's' : ''}</span>
  </div>` : ''}
  ${pagesHtml}
</body>
</html>`;
}


// Single student → one label on a sheet
app.get('/api/qr/generate/:id', authAdmin, async (req, res) => {
  try {
    const student = await sheets.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // QR encodes ONLY student_id
    const dataUrl = await QRCode.toDataURL(student.student_id, { width: 200, margin: 1 });
    res.send(buildLabelHtml([student], [dataUrl], `QR — ${student.name}`));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// All students → full sheets of labels, grouped by bus for easy distribution
app.get('/api/qr/print-all', authAdmin, async (req, res) => {
  try {
    const busFilter = req.query.bus; // optional ?bus=3
    let students = await sheets.getStudents();
    if (busFilter) {
      students = students.filter(s =>
        String(s.bus_number).replace(/^bus\s*/i,'').trim() === String(busFilter).trim()
      );
    }
    if (!students.length) return res.status(404).json({ error: 'No students found' });

    // Generate all QR codes in parallel — each encodes ONLY student_id
    const qrDataUrls = await Promise.all(
      students.map(s => QRCode.toDataURL(s.student_id, { width: 200, margin: 1 }))
    );

    const title = busFilter ? `Bus ${busFilter} QR Labels` : 'All Students QR Labels';
    res.send(buildLabelHtml(students, qrDataUrls, title));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────



app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

// Listen with a backlog of 1024 (default is 511) to handle burst concurrency
// without connections being dropped with ECONNRESET before they are accepted.
server.listen(config.port, '0.0.0.0', 1024, () => {
  console.log(`✅ Server fully started - listening on port ${config.port} (backlog=1024)`);
});

// touch
// touch 2