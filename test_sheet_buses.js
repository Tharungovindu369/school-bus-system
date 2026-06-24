const { getSheets } = require('./server/services/sheets.js');
const { config } = require('./server/config.js');

async function test() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: 'Buses!A:N'
  });
  console.log(`Buses count in sheets: ${res.data.values.length}`);
}
test();
