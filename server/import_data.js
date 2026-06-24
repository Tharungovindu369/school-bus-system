import XLSX from 'xlsx';
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

const sheets = google.sheets({ version: 'v4', auth: getAuth() });
const spreadsheetId = config.googleSheetsId;

function formatPhone(phone) {
  if (phone == null || phone === '') return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

function formatBusNumber(bus) {
  if (bus == null || bus === '') return '';
  const key = String(bus).replace(/^bus\s*/i, '').trim();
  if (!key) return '';
  return `Bus ${key}`;
}

async function main() {
  const filePath = "D:/Users/tharu/Downloads/students_final.xlsx";
  console.log(`Reading Excel file from ${filePath}...`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${rawRows.length} rows in Excel sheet.`);

  const studentRows = [];
  const uniqueBuses = new Set();

  for (const row of rawRows) {
    const student_id = String(row.student_id || '').trim();
    if (!student_id) continue;

    const name = String(row.name || '').trim();
    const year = String(row.year || '').trim();
    const branch = String(row.branch || '').trim();
    const className = branch ? `${year} ${branch}` : year;

    const rawBus = String(row.bus_number || '').trim();
    const bus_number = formatBusNumber(rawBus);
    if (bus_number) {
      uniqueBuses.add(bus_number);
    }

    const stop_name = String(row.stop_name || '').trim();
    const parent_name = String(row.father || '').trim();
    const phoneVal = row.parent_whatsapp || row.mobile || '';
    const parent_whatsapp = formatPhone(phoneVal);

    const fee_status = String(row.fee_status || 'DUE').toUpperCase().trim();
    const fee_due_date = String(row.fee_due_date || '2026-07-01').trim();

    studentRows.push([
      student_id,
      name,
      className,
      bus_number,
      stop_name,
      parent_name,
      parent_whatsapp,
      fee_status,
      fee_due_date,
    ]);
  }

  console.log(`Prepared ${studentRows.length} students for import.`);
  console.log(`Unique buses found:`, Array.from(uniqueBuses));

  // Generate buses list
  // Sort buses numerically/alphabetically
  const sortedBuses = Array.from(uniqueBuses).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10);
    const numB = parseInt(b.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const busRows = sortedBuses.map((bus) => {
    const busNum = bus.replace(/\D/g, '') || '*';
    const driverName = `Driver ${busNum}`;
    const driverPhone = ''; // Empty by default
    const routeName = `Route ${busNum}`;
    const capacity = '40';
    return [
      bus,
      driverName,
      driverPhone,
      routeName,
      capacity,
      '', // current_lat
      '', // current_lng
      '', // last_updated
      '', // morning_start_time
      '', // return_start_time
      'idle', // journey_type
      'idle', // current_status
      '', // morning_end_time
      '', // return_end_time
    ];
  });

  // Clear existing Students sheet below header and write
  console.log('Clearing and writing Students sheet...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Students!A2:I',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Students!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: studentRows },
  });
  console.log(`Successfully imported ${studentRows.length} students.`);

  // Clear existing Buses sheet below header and write
  console.log('Clearing and writing Buses sheet...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Buses!A2:N',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Buses!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: busRows },
  });
  console.log(`Successfully imported ${busRows.length} buses.`);

  console.log('All migrations completed successfully!');
}

main().catch(console.error);
