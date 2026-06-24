const { getSheets } = require('./server/services/sheets.js');
const { config } = require('./server/config.js');
async function del() {
  const sheets = await getSheets();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: config.googleSheetsId });
  const sheetId = spreadsheet.data.sheets.find(s => s.properties.title === 'Credentials').properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: { requests: [{ deleteSheet: { sheetId } }] }
  });
  console.log('Deleted Credentials sheet');
}
del();
