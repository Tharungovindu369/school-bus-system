const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const { formatBusNumber } = require('./utils.js');

const newEndpoints = `
app.post('/api/bus/start', async (req, res) => {
  try {
    const { bus_number, driver_name } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const formattedBus = bus_number; // Assuming formatBusNumber is done inside or caller handles it
    const startTime = new Date().toISOString();
    await sheets.updateBusMorningStart(formattedBus, startTime);
    const students = await sheets.getStudentsByBus(formattedBus);
    res.json({ success: true, bus_number: formattedBus, startTime, notificationsSent: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bus/start-return', async (req, res) => {
  try {
    const { bus_number, driver_name } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const formattedBus = bus_number;
    const startTime = new Date().toISOString();
    await sheets.updateBusReturnStart(formattedBus, startTime);
    const students = await sheets.getStudentsByBus(formattedBus);
    res.json({ success: true, bus_number: formattedBus, startTime, notificationsSent: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bus/stop', async (req, res) => {
  try {
    const { bus_number, driver_name } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const formattedBus = bus_number;
    const endTime = new Date().toISOString();
    await sheets.updateBusMorningStop(formattedBus, endTime);
    res.json({ success: true, bus_number: formattedBus, endTime, current_status: 'idle', notificationsSent: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bus/stop-return', async (req, res) => {
  try {
    const { bus_number, driver_name } = req.body;
    if (!bus_number) return res.status(400).json({ error: 'bus_number required' });
    const formattedBus = bus_number;
    const endTime = new Date().toISOString();
    await sheets.updateBusReturnStop(formattedBus, endTime);
    res.json({ success: true, bus_number: formattedBus, endTime, current_status: 'idle', notificationsSent: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lookup', async (req, res) => {
  try {
    const { student_id, last4 } = req.body;
    if (!student_id || !last4) {
      return res.status(400).json({ error: 'Student ID and 4-digit PIN required' });
    }
    const student = await sheets.getStudentById(student_id.trim().toUpperCase());
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const actualPhone = String(student.parent_whatsapp || '').trim();
    const phoneLast4 = actualPhone.length >= 4 ? actualPhone.slice(-4) : null;
    const adminSetLast4 = student.lookup_phone_last4;
    if (!phoneLast4 && !adminSetLast4) {
      return res.status(401).json({ error: 'Phone number not set up for this student. Please contact admin' });
    }
    if (last4 !== phoneLast4 && last4 !== adminSetLast4) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if boarded
    const attendance = await sheets.getTodayAttendance();
    const records = attendance.filter(r => r.student_id === student.student_id && r.date === new Date().toISOString().split('T')[0]);
    let status = 'Not yet boarded';
    let timestamp = null;
    if (records.length > 0) {
      status = 'Boarded';
      timestamp = records[records.length - 1].timestamp;
    }
    res.json({ success: true, student: { ...student, status, timestamp } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

code = code.replace('app.listen(config.port', newEndpoints + '\napp.listen(config.port');
fs.writeFileSync('server/index.js', code);
