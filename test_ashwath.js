const sheets = require('./server/services/sheets.js');
async function test() {
  const students = await sheets.getStudents();
  const s = students.find(x => x.name && x.name.includes('ASHWATH KUMAR REDDY'));
  console.log("Student:", s);

  if (s) {
    const att = await sheets.getAttendance();
    const records = att.filter(r => r.student_id === s.student_id);
    console.log("Attendance records:", records);
  }
}
test().catch(console.error);
