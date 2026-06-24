import { google } from 'googleapis';
import { config } from './config.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuth() {
  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: SCOPES,
  });
}

async function run() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Clear everything
    await sheets.spreadsheets.values.clear({
      spreadsheetId: config.googleSheetsId,
      range: 'Credentials!A:C'
    });
    console.log('Cleared old credentials.');

    // Prepare fresh credentials
    const rows = [];
    rows.push(['Type', 'Key', 'Value']);
    rows.push(['Admin', 'adminPassword', 'admin123']);
    rows.push(['Reception', 'receptionPin', '9999']);
    rows.push(['Accountant', 'accountantPin', '1234']);
    rows.push(['BusIncharge', 'busInchargePin', '5678']);
    
    for (let i = 1; i <= 44; i++) {
      const pin = String(i).padStart(4, '0');
      rows.push(['Driver', String(i), pin]);
    }
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetsId,
      range: `Credentials!A1:C${rows.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });
    
    console.log(`Successfully wrote ${rows.length} rows to Credentials.`);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

run();
