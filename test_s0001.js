const sheets = require('./server/services/sheets.js');
async function test() {
  const student = await sheets.getStudentById('S0001');
  console.log(student);
}
test();
