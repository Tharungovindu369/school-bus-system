const sheets = require('./server/services/sheets.js');
async function test() {
  const att = await sheets.getAttendance();
  const r = att.filter(a => a.student_id === 'S0040' && a.date === '2026-06-20');
  console.log(r);
}
test();
