const fs = require('fs');
let content = fs.readFileSync('index_backup.js', 'utf8');

// 1. Imports
content = content.replace(
  "import { getAllCredentials, updateCredential } from './services/credentials.js';",
  "import { getAllCredentials, updateCredential, getAdminPassword, getAccountantPin, getBusInchargePin } from './services/credentials.js';"
);

// 2. Middleware
const middleware = `
// AUTH MIDDLEWARE
async function authAdmin(req, res, next) {
  try {
    const pwd = await getAdminPassword();
    if (req.headers['x-admin-password'] === pwd) return next();
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authAccountant(req, res, next) {
  try {
    const adminPwd = await getAdminPassword();
    if (req.headers['x-admin-password'] === adminPwd) return next();
    const accPin = await getAccountantPin();
    if (req.headers['x-accountant-pin'] === accPin) return next();
    res.status(403).json({ error: 'Forbidden: Accountant access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authBusIncharge(req, res, next) {
  try {
    const adminPwd = await getAdminPassword();
    if (req.headers['x-admin-password'] === adminPwd) return next();
    const busPin = await getBusInchargePin();
    if (req.headers['x-bus-incharge-pin'] === busPin) return next();
    res.status(403).json({ error: 'Forbidden: Bus Incharge access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function authAnyStaff(req, res, next) {
  try {
    const adminPwd = await getAdminPassword();
    if (req.headers['x-admin-password'] === adminPwd) return next();
    const accPin = await getAccountantPin();
    if (req.headers['x-accountant-pin'] === accPin) return next();
    const busPin = await getBusInchargePin();
    if (req.headers['x-bus-incharge-pin'] === busPin) return next();
    res.status(403).json({ error: 'Forbidden: Staff access required' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// HEALTH & PUBLIC ROUTES`;

content = content.replace('// HEALTH & PUBLIC ROUTES', middleware);

// 3. Login
const oldAdminLogin = `app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === config.adminPassword) return res.json({ success: true });
  res.status(401).json({ success: false, message: 'Invalid password' });
});`;

const newLogins = `app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  const { password } = req.body;
  const pwd = await getAdminPassword();
  if (password === pwd) return res.json({ success: true, role: 'admin' });
  res.status(401).json({ success: false, message: 'Invalid password' });
});

app.post('/api/accountant/login', adminLoginLimiter, async (req, res) => {
  const { pin } = req.body;
  const accPin = await getAccountantPin();
  if (pin === accPin) return res.json({ success: true, role: 'accountant' });
  res.status(401).json({ success: false, message: 'Invalid PIN' });
});

app.post('/api/bus-incharge/login', adminLoginLimiter, async (req, res) => {
  const { pin } = req.body;
  const busPin = await getBusInchargePin();
  if (pin === busPin) return res.json({ success: true, role: 'bus_incharge' });
  res.status(401).json({ success: false, message: 'Invalid PIN' });
});`;

content = content.replace(oldAdminLogin, newLogins);

// 4. Update endpoints with middleware
const endpointReplacements = [
  // Dashboard -> AnyStaff
  ["app.get('/api/admin/dashboard', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });", 
   "app.get('/api/admin/dashboard', authAnyStaff, async (req, res) => {\n  try {"],
  // Fee -> Accountant
  ["app.put('/api/fee/:id', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.put('/api/fee/:id', authAccountant, async (req, res) => {\n  try {"],
  ["app.put('/api/students/bulk-fee', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.put('/api/students/bulk-fee', authAccountant, async (req, res) => {\n  try {"],
  // Student Bus -> Admin
  ["app.put('/api/students/:id/bus', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.put('/api/students/:id/bus', authAdmin, async (req, res) => {\n  try {"],
  ["app.put('/api/students/bulk-bus', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.put('/api/students/bulk-bus', authAdmin, async (req, res) => {\n  try {"],
  // Bus Driver -> BusIncharge
  ["app.put('/api/bus/:number/driver', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.put('/api/bus/:number/driver', authBusIncharge, async (req, res) => {\n  try {"],
  // Student Profile -> Accountant
  ["app.get('/api/admin/student/:id', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.get('/api/admin/student/:id', authAccountant, async (req, res) => {\n  try {"],
  // Incidents -> Admin
  ["app.get('/api/incidents', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.get('/api/incidents', authAdmin, async (req, res) => {\n  try {"],
  // Credentials -> Admin
  ["app.get('/api/admin/credentials', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.get('/api/admin/credentials', authAdmin, async (req, res) => {\n  try {"],
  ["app.put('/api/admin/credentials', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.put('/api/admin/credentials', authAdmin, async (req, res) => {\n  try {"],
  // Reassignments -> BusIncharge
  ["app.get('/api/reassignments/active', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.get('/api/reassignments/active', authBusIncharge, async (req, res) => {\n  try {"],
  ["app.post('/api/reassignments', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.post('/api/reassignments', authBusIncharge, async (req, res) => {\n  try {"],
  ["app.post('/api/reassignments/:bus/end', async (req, res) => {\n  try {\n    if (req.headers['x-admin-password'] !== config.adminPassword) return res.status(401).json({ error: 'Unauthorized' });",
   "app.post('/api/reassignments/:bus/end', authBusIncharge, async (req, res) => {\n  try {"],
];

endpointReplacements.forEach(([oldStr, newStr]) => {
  content = content.replace(oldStr, newStr);
});

// 5. Exports security
const oldExportAtt = "app.get('/api/admin/export/attendance', async (req, res) => {";
const newExportAtt = "app.get('/api/admin/export/attendance', authAdmin, async (req, res) => {";
content = content.replace(oldExportAtt, newExportAtt);

const oldExportInc = "app.get('/api/admin/export/incidents', async (req, res) => {";
const newExportInc = "app.get('/api/admin/export/incidents', authAdmin, async (req, res) => {";
content = content.replace(oldExportInc, newExportInc);

// 6. Yellow Gate Scanner logic + IsDue
// Find POST /api/reception/scan
const recScanTarget = `app.post('/api/reception/scan', async (req, res) => {
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
    }`;

const recScanNew = `app.post('/api/reception/scan', async (req, res) => {
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
    }`;

content = content.replace(recScanTarget, recScanNew);

// 7. Return driverScanned and isDue
content = content.replace(
  "res.json({ success: true, student });",
  "res.json({ success: true, student, driverScanned, isDue });"
);

// 8. Add Student Endpoint
const addStudentCode = `
app.post('/api/students', authAdmin, async (req, res) => {
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

// Add single QR code generation
import QRCode from 'qrcode';
app.get('/api/qr/generate/:id', authAdmin, async (req, res) => {
  try {
    const student = await sheets.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const payload = JSON.stringify({
      student_id: student.student_id,
      name: student.name,
      bus_number: String(student.bus_number).replace(/^bus\\s*/i, '').trim()
    });
    
    const dataUrl = await QRCode.toDataURL(payload, { width: 250, margin: 1 });
    
    const html = \`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; padding: 20px; background: #fff; }
    .card { width: 240px; height: 350px; border: 2px solid #2563eb; border-radius: 12px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
    .school { font-size: 11px; color: #2563eb; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
    img { width: 160px; height: 160px; margin-bottom: 8px; }
    .id { font-size: 24px; font-weight: bold; color: #000; margin-bottom: 4px; }
    .name { font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 4px; }
    .phone { font-size: 14px; color: #475569; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">Print Card</button>
  </div>
  <div class="card">
    <div class="school">\${config.schoolName}</div>
    <img src="\${dataUrl}" />
    <div class="id">\${student.student_id}</div>
    <div class="name">\${student.name}</div>
    <div class="phone">📞 \${student.parent_whatsapp || 'No Phone'}</div>
  </div>
</body>
</html>\`;
    res.send(html);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
`;

content = content.replace("app.use(express.static(path.join(__dirname, '../client/dist')));", addStudentCode + "\napp.use(express.static(path.join(__dirname, '../client/dist')));");

fs.writeFileSync('index.js', content);
console.log('index.js updated successfully');
