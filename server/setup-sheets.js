/**
 * One-time script to write column headers to all Google Sheets tabs.
 * Run: node server/setup-sheets.js
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const auth = new google.auth.JWT({
  email: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

const TAB_HEADERS = {
  Students: [
    'student_id', 'name', 'class', 'bus_number', 'stop_name',
    'parent_name', 'parent_whatsapp', 'fee_status', 'fee_due_date',
  ],
  Attendance: [
    'timestamp', 'student_id', 'student_name', 'bus_number', 'stop_name',
    'boarded_at', 'driver_name', 'date', 'notification_status', 'scan_type',
    'dropoff_time', 'scanned_by', 'arrival_time',
    'is_cross_bus', 'actual_bus', 'assigned_bus',
  ],
  Buses: [
    'bus_number', 'driver_name', 'driver_phone', 'route_name', 'capacity',
    'current_lat', 'current_lng', 'last_updated', 'morning_start_time',
    'return_start_time', 'journey_type', 'current_status',
    'morning_end_time', 'return_end_time',
  ],
  Incidents: [
    'date', 'student_id', 'student_name', 'bus_number', 'driver_name',
    'incident_type', 'details', 'timestamp',
  ],
  Driver_Reassignments: [
    'date', 'bus_number', 'original_driver', 'temp_driver', 'reason',
    'reassigned_by', 'timestamp', 'end_date', 'reverted',
    'temp_driver_phone', 'original_driver_phone', 'temp_driver_bus',
  ],
  AuditLog: [
    'timestamp', 'action_type', 'target', 'new_value', 'reason',
  ],
};

async function ensureTab(title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    console.log(`Created tab: ${title}`);
  }
}

async function writeHeaders(title, headers) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
  console.log(`Headers written: ${title} (${headers.length} columns)`);
}

async function main() {
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID not set in .env');

  for (const [tab, headers] of Object.entries(TAB_HEADERS)) {
    await ensureTab(tab);
    await writeHeaders(tab, headers);
  }

  console.log('\nDone! All sheet headers are configured.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
