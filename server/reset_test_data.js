/**
 * RESET SCRIPT — Clears all test data before manual testing
 * Deletes today's attendance from Google Sheets, wipes the in-memory
 * queue backup, and resets bus start times so everything is clean.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Load credentials exactly as config.js does
function loadGoogleCredentials() {
  const credPath = path.resolve(__dirname, '../credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (creds.private_key && creds.private_key !== 'PLACEHOLDER') {
        return { email: creds.client_email, privateKey: creds.private_key };
      }
    } catch { /* fall through */ }
  }
  const raw = process.env.GOOGLE_PRIVATE_KEY || '';
  return {
    email: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
    privateKey: raw.replace(/\\n/g, '\n'),
  };
}

const googleCreds = loadGoogleCredentials();
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SERVICE_EMAIL = googleCreds.email;
const PRIVATE_KEY = googleCreds.privateKey;

const QUEUE_FILE = path.join(__dirname, 'data', 'queue_backup.json');

const C = {
  green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m',
  yellow: '\x1b[33m', bold: '\x1b[1m', reset: '\x1b[0m'
};
const ok   = s => console.log(`${C.green}✅${C.reset} ${s}`);
const err  = s => console.log(`${C.red}❌${C.reset} ${s}`);
const info = s => console.log(`${C.cyan}   ℹ${C.reset}  ${s}`);
const warn = s => console.log(`${C.yellow}⚠️ ${C.reset} ${s}`);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function getSheets() {
  const auth = new google.auth.JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function clearTodayAttendance(sheetsApi) {
  console.log('\n━━━ Clearing Today\'s Attendance ━━━');
  const today = todayStr();

  // Read all attendance rows
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Attendance!A:J',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) {
    warn('No attendance rows found in sheet');
    return;
  }

  const header = rows[0];
  const dateColIdx = header.findIndex(h => h.trim().toLowerCase() === 'date');
  if (dateColIdx === -1) {
    err('Cannot find "date" column in Attendance sheet');
    return;
  }

  // Collect 1-based sheet row numbers for today's records (header is row 1, data starts row 2)
  const todayRowIndices = [];
  for (let i = 1; i < rows.length; i++) {
    const rowDate = (rows[i][dateColIdx] || '').trim();
    if (rowDate === today) {
      todayRowIndices.push(i + 1); // +1 because sheet rows are 1-indexed and header is row 1
    }
  }

  info(`Found ${todayRowIndices.length} attendance records for ${today}`);
  if (todayRowIndices.length === 0) {
    ok('No records to delete — attendance is already clean');
    return;
  }

  // Get spreadsheet to find the sheet ID for Attendance tab
  const metaRes = await sheetsApi.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const attendanceSheet = metaRes.data.sheets.find(
    s => s.properties.title.toLowerCase() === 'attendance'
  );
  if (!attendanceSheet) {
    err('Attendance sheet tab not found');
    return;
  }
  const sheetTabId = attendanceSheet.properties.sheetId;

  // Sort descending so we delete from bottom up (row indices don't shift)
  todayRowIndices.sort((a, b) => b - a);

  // Build deleteDimension requests in batches
  const requests = todayRowIndices.map(rowNum => ({
    deleteDimension: {
      range: {
        sheetId: sheetTabId,
        dimension: 'ROWS',
        startIndex: rowNum - 1, // 0-indexed
        endIndex: rowNum,       // exclusive
      }
    }
  }));

  // Google Sheets batchUpdate accepts up to 1000 requests per call
  const BATCH = 100;
  for (let i = 0; i < requests.length; i += BATCH) {
    const batch = requests.slice(i, i + BATCH);
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: batch },
    });
    info(`Deleted rows ${i + 1}–${Math.min(i + BATCH, requests.length)} / ${requests.length}`);
  }

  ok(`Deleted ${todayRowIndices.length} attendance records for ${today}`);
}

async function clearTodayIncidents(sheetsApi) {
  console.log('\n━━━ Clearing Today\'s Incidents ━━━');
  const today = todayStr();

  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Incidents!A:H',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) { warn('No incident rows'); return; }

  const header = rows[0];
  const dateColIdx = header.findIndex(h => h.trim().toLowerCase() === 'date');
  if (dateColIdx === -1) { warn('No date column in Incidents'); return; }

  const todayRows = [];
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][dateColIdx] || '').trim() === today) todayRows.push(i + 1);
  }
  info(`Found ${todayRows.length} incident records for ${today}`);
  if (!todayRows.length) { ok('Incidents already clean'); return; }

  const metaRes = await sheetsApi.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title.toLowerCase() === 'incidents');
  if (!sheet) { warn('Incidents sheet tab not found — skipping'); return; }
  const sheetTabId = sheet.properties.sheetId;

  todayRows.sort((a, b) => b - a);
  const requests = todayRows.map(rowNum => ({
    deleteDimension: {
      range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum }
    }
  }));

  const BATCH = 100;
  for (let i = 0; i < requests.length; i += BATCH) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: requests.slice(i, i + BATCH) },
    });
  }
  ok(`Deleted ${todayRows.length} incidents for ${today}`);
}

async function resetBusStatuses(sheetsApi) {
  console.log('\n━━━ Resetting Bus Statuses ━━━');

  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Buses!A:N',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) { warn('No bus rows'); return; }

  const header = rows[0];
  const statusColIdx  = header.findIndex(h => h.trim().toLowerCase() === 'current_status');
  const mStartColIdx  = header.findIndex(h => h.trim().toLowerCase() === 'morning_start_time');
  const mEndColIdx    = header.findIndex(h => h.trim().toLowerCase() === 'morning_end_time');
  const rStartColIdx  = header.findIndex(h => h.trim().toLowerCase() === 'return_start_time');
  const rEndColIdx    = header.findIndex(h => h.trim().toLowerCase() === 'return_end_time');
  const busColIdx     = header.findIndex(h => h.trim().toLowerCase() === 'bus_number');

  const metaRes = await sheetsApi.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title.toLowerCase() === 'buses');
  if (!sheet) { warn('Buses sheet not found'); return; }

  let resetCount = 0;
  const requests = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const status = row[statusColIdx] || '';
    const mStart = row[mStartColIdx] || '';
    // Only reset buses that have been started today
    if (!mStart && status === 'idle') continue;

    const sheetRow = i + 1;
    // Clear morning_start_time, morning_end_time, return_start_time, return_end_time, status → idle
    // We'll update columns I through L (adjust based on header positions)
    if (mStartColIdx !== -1) {
      requests.push({
        updateCells: {
          range: {
            sheetId: sheet.properties.sheetId,
            startRowIndex: sheetRow - 1,
            endRowIndex: sheetRow,
            startColumnIndex: Math.min(mStartColIdx, rEndColIdx),
            endColumnIndex: Math.max(mStartColIdx, mEndColIdx, rStartColIdx, rEndColIdx, statusColIdx) + 1,
          },
          rows: [{ values: Array(
            Math.max(mStartColIdx, mEndColIdx, rStartColIdx, rEndColIdx, statusColIdx) -
            Math.min(mStartColIdx, rEndColIdx) + 1
          ).fill({ userEnteredValue: { stringValue: '' } }) }],
          fields: 'userEnteredValue',
        }
      });
    }
    resetCount++;
    info(`Queued reset for bus row ${sheetRow} (${row[busColIdx] || 'unknown'})`);
  }

  if (requests.length === 0) { ok('All buses already at idle state'); return; }

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests },
  });
  ok(`Reset ${resetCount} buses to idle state`);
}

function clearQueueBackup() {
  console.log('\n━━━ Clearing Queue Backup ━━━');
  const empty = JSON.stringify({ attendanceQueue: [], incidentQueue: [] });
  try {
    const dir = path.dirname(QUEUE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(QUEUE_FILE, empty);
    ok('queue_backup.json cleared');
  } catch (e) {
    err('Failed to clear queue backup: ' + e.message);
  }
}

async function main() {
  console.log(`\n${C.bold}╔══════════════════════════════════════════╗`);
  console.log(`║   SCHOOL BUS SYSTEM — DATA RESET TOOL   ║`);
  console.log(`╚══════════════════════════════════════════╝${C.reset}`);
  console.log(`\nResetting data for: ${C.bold}${todayStr()}${C.reset}\n`);

  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    err('Missing environment variables. Make sure .env is loaded.');
    process.exit(1);
  }

  const sheetsApi = await getSheets();

  await clearTodayAttendance(sheetsApi);
  await clearTodayIncidents(sheetsApi);
  await resetBusStatuses(sheetsApi);
  clearQueueBackup();

  console.log(`\n${C.bold}${C.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log(`${C.bold}${C.green}  ✅  ALL RESET — Ready for manual testing!  ${C.reset}`);
  console.log(`${C.bold}${C.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`);
  console.log('Now restart the server:  node index.js');
}

main().catch(e => {
  err('Reset failed: ' + e.message);
  console.error(e);
  process.exit(1);
});
