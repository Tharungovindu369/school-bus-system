const sheets = require('./server/services/sheets.js');
async function test() {
  const students = await sheets.getStudents();
  const empty = students.find(s => !s.lookup_phone_last4);
  console.log("Empty student:", empty);
}
test().catch(console.error);
