const sheets = require('./server/services/sheets.js');
async function test() {
  const rows = await sheets.getSheetData('Students!A1:K1');
  console.log("Headers:", rows[0]);
}
test().catch(console.error);
