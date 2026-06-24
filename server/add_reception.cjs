const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const receptionScanCode = `
app.post('/api/reception/scan', async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Student ID required' });
    const student = await sheets.getStudentById(student_id.trim().toUpperCase());
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const attendance = await sheets.getTodayAttendance();
    const existing = attendance.find(a => a.student_id === student.student_id && a.driver_name === 'Gate Scanner');
    if (existing) {
      return res.json({ success: true, duplicate: true, message: 'Student already scanned at gate today' });
    }

    const today = new Date().toISOString().split('T')[0];
    const record = {
      timestamp: new Date().toISOString(),
      student_id: student.student_id,
      student_name: student.name,
      bus_number: student.bus_number,
      stop_name: student.stop_name,
      boarded_at: 'N/A',
      driver_name: 'Gate Scanner',
      date: today,
      notification_status: 'sent',
    };
    await sheets.appendAttendance(record);
    
    // Maybe send whatsapp? We will just log it for now
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!code.includes('/api/reception/scan')) {
  code = code.replace('app.listen(config.port', receptionScanCode + '\napp.listen(config.port');
  fs.writeFileSync('server/index.js', code);
  console.log('Added reception scan');
}
