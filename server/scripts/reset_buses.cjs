const { google } = require('googleapis');
const { config } = require('../config.js');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function resetBuses() {
  const auth = new google.auth.JWT({ email: config.googleServiceAccountEmail, key: config.googlePrivateKey, scopes: SCOPES });
  const sheets = google.sheets({ version: 'v4', auth });
  
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.googleSheetsId, range: 'Buses!A:L' });
  const rows = res.data.values || [];
  
  const updates = [];
  for (let i = 1; i < rows.length; i++) {
    const sheetRow = i + 1;
    // Clear out I (morning start), J (return start), K (journey type), L (current_status), M (morning end), N (return end)
    updates.push({
      range: `Buses!I${sheetRow}:N${sheetRow}`,
      values: [['', '', '', 'idle', '', '']]
    });
  }
  
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.googleSheetsId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
    });
    console.log('Reset bus running statuses successfully.');
  } else {
    console.log('No buses to reset.');
  }
}

resetBuses().catch(console.error);
