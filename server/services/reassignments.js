import { google } from 'googleapis';
import { config } from '../config.js';
import { busNumberKey, formatBusNumber, getISTDateString, parseSheetDate } from '../utils.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
let sheetsClient = null;

function getAuth() {
  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: SCOPES,
  });
}

async function getSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  }
  return sheetsClient;
}

async function getSheetData(range) {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range,
  });
  return response.data.values || [];
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== ''))
    .map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header.trim()] = row[i] ?? '';
      });
      return obj;
    });
}

function findBusRowIndex(records, busNumber) {
  const key = busNumberKey(busNumber);
  return records.findIndex((b) => busNumberKey(b.bus_number) === key);
}

export async function getReassignments() {
  try {
    const rows = await getSheetData('Driver_Reassignments!A:L');
    return rowsToObjects(rows).map((r) => ({
      ...r,
      date: parseSheetDate(r.date),
      end_date: parseSheetDate(r.end_date),
      bus_number: formatBusNumber(r.bus_number),
    }));
  } catch {
    return [];
  }
}

export async function getActiveReassignments(date = getISTDateString()) {
  const all = await getReassignments();
  return all.filter(
    (r) =>
      (r.reverted || '').toLowerCase() !== 'yes' &&
      (r.end_date || r.date) >= date
  );
}

export async function getActiveReassignmentForBus(busNumber, date = getISTDateString()) {
  const key = busNumberKey(busNumber);
  const active = await getActiveReassignments(date);
  const forBus = active.filter((r) => busNumberKey(r.bus_number) === key);
  if (!forBus.length) return null;
  return forBus.sort((a, b) =>
    (b.end_date || b.date).localeCompare(a.end_date || a.date)
  )[0];
}

export async function revertExpiredReassignments() {
  const today = getISTDateString();
  const all = await getReassignments();
  const expired = all.filter(
    (r) =>
      (r.reverted || '').toLowerCase() !== 'yes' &&
      r.end_date &&
      r.end_date < today
  );

  for (const r of expired) {
    await revertReassignment(r);
  }
  return expired.length;
}

async function revertReassignment(record) {
  const rows = await getSheetData('Buses!A:N');
  const records = rowsToObjects(rows);
  const rowIndex = findBusRowIndex(records, record.bus_number);
  if (rowIndex === -1) return;

  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!B${sheetRow}:C${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[record.original_driver, record.original_driver_phone || '']],
    },
  });

  const reassignmentRows = await getReassignments();
  const reassignIndex = reassignmentRows.findIndex(
    (r) =>
      r.bus_number === record.bus_number &&
      r.date === record.date &&
      r.temp_driver === record.temp_driver &&
      (r.reverted || '').toLowerCase() !== 'yes'
  );
  if (reassignIndex === -1) return;

  const sheetDataRow = reassignIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Driver_Reassignments!I${sheetDataRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['yes']] },
  });
}

async function markReassignmentSuperseded(record) {
  const reassignmentRows = await getReassignments();
  const reassignIndex = reassignmentRows.findIndex(
    (r) =>
      busNumberKey(r.bus_number) === busNumberKey(record.bus_number) &&
      r.date === record.date &&
      r.temp_driver === record.temp_driver &&
      (r.reverted || '').toLowerCase() !== 'yes'
  );
  if (reassignIndex === -1) return;

  const sheets = await getSheets();
  const sheetDataRow = reassignIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Driver_Reassignments!I${sheetDataRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['yes']] },
  });
}

export async function createReassignment({
  bus_number,
  temp_driver,
  temp_driver_phone,
  temp_driver_bus,
  reason,
  reassigned_by,
  end_date,
  is_temporary = true,
}) {
  await revertExpiredReassignments();

  const busRows = await getSheetData('Buses!A:N');
  const busRecords = rowsToObjects(busRows);
  const rowIndex = findBusRowIndex(busRecords, bus_number);
  if (rowIndex === -1) throw new Error('Bus not found');

  const bus = busRecords[rowIndex];
  const today = getISTDateString();
  const formattedBus = formatBusNumber(bus_number);

  const existingActive = await getActiveReassignmentForBus(formattedBus);
  if (existingActive) {
    await markReassignmentSuperseded(existingActive);
  }

  const originalDriver = existingActive?.original_driver || bus.driver_name;
  const originalDriverPhone = existingActive?.original_driver_phone || bus.driver_phone || '';

  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!B${sheetRow}:C${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[temp_driver, temp_driver_phone || '']] },
  });

  if (is_temporary) {
    const values = [[
      today,
      formattedBus,
      originalDriver,
      temp_driver,
      reason || '',
      reassigned_by || 'admin',
      new Date().toISOString(),
      end_date || today,
      'no',
      temp_driver_phone || '',
      originalDriverPhone,
      temp_driver_bus || '',
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetsId,
      range: 'Driver_Reassignments!A:L',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  }

  return {
    bus_number: formattedBus,
    original_driver: originalDriver,
    temp_driver,
    end_date: end_date || today,
  };
}

export async function findDriverHomeBus(driverName, buses) {
  const bus = buses.find(
    (b) => (b.driver_name || '').toLowerCase() === driverName.toLowerCase()
  );
  return bus ? formatBusNumber(bus.bus_number) : '';
}
