const sheets = require('./server/services/sheets.js');
async function test() {
  const rows = await sheets.getSheetData('Credentials!A:C');
  console.log(rows);
}
test().catch(console.error);
