import { google } from 'googleapis';
import { config } from './config.js';

async function test() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.googleClientEmail,
      private_key: config.googlePrivateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A1:K1',
  });
  console.log("Headers:", res.data.values[0]);
}
test().catch(console.error);
