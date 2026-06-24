const sheets = require('./server/services/sheets.js');
async function test() {
  const s = await sheets.getStudentById('S0001');
  console.log(s);
}
test().catch(console.error);
