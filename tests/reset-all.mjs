import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parsePrivateKey(raw) {
  if (!raw) return '';
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const sheets = google.sheets({ version: 'v4', auth: getAuth() });
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

if (!spreadsheetId) {
  console.error('ERROR: GOOGLE_SHEETS_ID is required in .env');
  process.exit(1);
}

async function clearRange(range) {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.log(`Range ${range} already empty`);
      return;
    }
    await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    console.log(`Cleared ${rows.length} rows from ${range}`);
  } catch (err) {
    if (err.code === 404) {
      console.log(`Sheet or range ${range} not found, skipping`);
      return;
    }
    throw err;
  }
}

async function run() {
  try {
    await clearRange('Attendance!A2:J1000');
    await clearRange('Incidents!A2:H1000');
    await clearRange('Driver_Reassignments!A2:H1000');

    const busResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Buses!A2:I1000' });
    const busRows = busResponse.data.values || [];
    if (busRows.length > 0) {
      const resetRows = busRows.map((row) => [row[0], '', '', row[3] || '', row[4] || '', '', '', 'idle', '']);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Buses!A2:I${busRows.length + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: resetRows }
      });
      console.log('Reset Buses rows');
    } else {
      console.log('No Buses rows to reset');
    }

    const studentResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Students!A2:K1000' });
    const studentRows = studentResponse.data.values || [];
    if (studentRows.length > 0) {
      const resetStudents = studentRows.map((row) => {
        const newRow = [...row];
        if (newRow.length < 10) {
          newRow.length = 10;
        }
        newRow[7] = 'PAID';
        newRow[8] = '';
        newRow[9] = '';
        return newRow;
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Students!A2:K${studentRows.length + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: resetStudents }
      });
      console.log('Reset Students fee values');
    } else {
      console.log('No Students rows to reset');
    }

    const queueFile = path.resolve(process.cwd(), 'data', 'queue_backup.json');
    fs.mkdirSync(path.dirname(queueFile), { recursive: true });
    fs.writeFileSync(queueFile, JSON.stringify({ attendanceQueue: [], incidentQueue: [] }, null, 2));
    console.log('Reset queue backup file');

    console.log('Reset all complete.');
  } catch (err) {
    console.error('Reset-all error:', err.message || err);
    process.exit(1);
  }
}

run();
