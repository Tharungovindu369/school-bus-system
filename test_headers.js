const sheets = require('./server/services/sheets.js');
async function test() {
  const rows = await sheets.getSheetData('Students!A1:J1');
  console.log(rows);
}
test().catch(console.error);
