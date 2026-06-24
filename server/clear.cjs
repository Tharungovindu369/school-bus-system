const { google } = require('googleapis');
const credentials = require('../credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
async function run() {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = require('./config.js').config.googleSheetsId;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Attendance!A:H' });
  const length = res.data.values ? res.data.values.length : 0;
  if (length > 1) {
     await sheets.spreadsheets.values.clear({ spreadsheetId, range: `Attendance!A2:I${length}` });
     console.log('Cleared', length - 1, 'rows');
  } else {
     console.log('Nothing to clear');
  }
}
run();
