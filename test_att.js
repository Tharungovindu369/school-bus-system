const sheets = require('./server/services/sheets.js');
async function test() {
  const att = await sheets.getAttendance();
  const r = att.find(a => a.student_id === 'S0040' && a.date === '2026-06-20' && a.scan_type === 'dropoff');
  console.log('Final notification status:', r.notification_status);
}
test();

