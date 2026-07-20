import { google } from 'googleapis';
import { config } from '../config.js';
import { getISTDateString } from '../utils.js';
import { Readable } from 'stream';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/cloud-platform'
];

let sheetsClient = null;

function busNumberKey(bus) {
  if (bus == null || bus === '') return '';
  return String(bus).replace(/^bus\s*/i, '').trim();
}

function getAuth() {
  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: SCOPES,
  });
}

export async function getSheets() {
  if (!sheetsClient) {
    const auth = getAuth();
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

let studentsCache = { timestamp: 0, map: new Map(), list: [] };
let busesCache = { timestamp: 0, map: new Map(), list: [] };
let todayAttendanceCache = { date: '', timestamp: 0, records: [] };
const CACHE_TTL_MS = 10000;
const cache = {};

export function invalidateTodayAttendanceCache() {
  todayAttendanceCache = { date: '', timestamp: 0, records: [] };
}

let fetchPromises = {};

export async function getSheetData(range) {
  const now = Date.now();
  
  // If we don't have it cached at all, we MUST wait for it.
  if (!cache[range]) {
    if (!fetchPromises[range]) {
      fetchPromises[range] = (async () => {
        try {
          const sheets = await getSheets();
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.googleSheetsId,
            range,
          });
          const data = response.data.values || [];
          cache[range] = { timestamp: Date.now(), data };
          return data;
        } finally {
          delete fetchPromises[range];
        }
      })();
    }
    return fetchPromises[range];
  }

  // If we have it but it's expired, trigger background refresh (Stale-While-Revalidate)
  if (now - cache[range].timestamp >= CACHE_TTL_MS) {
    if (!fetchPromises[range]) {
      fetchPromises[range] = (async () => {
        try {
          const sheets = await getSheets();
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.googleSheetsId,
            range,
          });
          const data = response.data.values || [];
          cache[range] = { timestamp: Date.now(), data };
          return data;
        } catch (err) {
          console.error(`Background refresh failed for ${range}:`, err.message);
        } finally {
          delete fetchPromises[range];
        }
      })();
    }
  }

  // Return the data instantly (either fresh or stale-while-revalidating)
  return cache[range].data;
}

export function appendToCache(range, values) {
  if (cache[range] && cache[range].data) {
    cache[range].data.push(...values);
  }
  if (range.startsWith('Attendance')) {
    invalidateTodayAttendanceCache();
  }
}

export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const [headers, ...dataRows] = rows;
  return dataRows
    .map((row, i) => {
      if (!row.some((cell) => cell !== undefined && cell !== '')) return null;
      const obj = { _sheetRow: i + 2 };
      headers.forEach((header, colIdx) => {
        obj[header.trim()] = row[colIdx] ?? '';
      });
      return obj;
    })
    .filter(Boolean);
}

let hasEnsuredHeaders = false;
let hasEnsuredFcmHeader = false;

async function ensureStudentStatusHeader() {
  if (hasEnsuredHeaders) return;
  try {
    const sheets = await getSheets();
    const rows = await getSheetData('Students!A1:L1');
    const headers = rows[0] || [];
    if (headers.length < 12 || headers[11] !== 'status') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetsId,
        range: 'Students!L1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['status']] }
      });
      clearCache('Students!A1:M1');
      clearCache('Students!A:M');
    }
    hasEnsuredHeaders = true;
  } catch (err) {
    console.error('Failed to ensure student status header:', err.message);
  }
}

async function ensureStudentFcmTokenHeader() {
  if (hasEnsuredFcmHeader) return;
  try {
    const sheets = await getSheets();
    const rows = await getSheetData('Students!A1:M1');
    const headers = rows[0] || [];
    if (headers.length < 13 || headers[12] !== 'fcm_token') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetsId,
        range: 'Students!M1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['fcm_token']] }
      });
      clearCache('Students!A1:M1');
      clearCache('Students!A:M');
    }
    hasEnsuredFcmHeader = true;
  } catch (err) {
    console.error('Failed to ensure student fcm_token header:', err.message);
  }
}

export async function addStudent(s) {
  const sheets = await getSheets();
  const phone = s.parent_whatsapp || '';
  const last4 = phone.length >= 4 ? phone.slice(-4) : phone;
  const row = [
    s.student_id,
    s.name,
    s.class || '',
    s.bus_number,
    s.stop_name,
    s.parent_name || '',
    phone,
    'DUE',
    '',
    s.fee_paid_until || '',
    last4,
    'ACTIVE'
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A:M',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

export async function getStudents() {
  const now = Date.now();
  if (now - studentsCache.timestamp < CACHE_TTL_MS) return studentsCache.list;
  await ensureStudentStatusHeader();
  await ensureStudentFcmTokenHeader();
  const rows = await getSheetData('Students!A:M');
  const list = rowsToObjects(rows);
  const map = new Map();
  list.forEach(s => {
    s.status = s.status || 'ACTIVE';
    map.set(s.student_id, s);
  });
  studentsCache = { timestamp: now, map, list };
  return list;
}

export async function getStudentById(studentId) {
  const now = Date.now();
  if (now - studentsCache.timestamp < CACHE_TTL_MS && studentsCache.map.has(studentId)) {
    return studentsCache.map.get(studentId);
  }
  await getStudents();
  return studentsCache.map.get(studentId);
}

export async function getStudentsByBus(busNumber) {
  const students = await getStudents();
  return students.filter((s) => busNumberKey(s.default_bus) === busNumberKey(busNumber) || busNumberKey(s.assigned_bus) === busNumberKey(busNumber) || busNumberKey(s.bus_number) === busNumberKey(busNumber));
}

let hasEnsuredBusHeaders = false;
async function ensureBusNextStopHeader() {
  if (hasEnsuredBusHeaders) return;
  try {
    const sheets = await getSheets();
    const rows = await getSheetData('Buses!A1:P1');
    const headers = rows[0] || [];
    if (headers.length < 16 || headers[14] !== 'next_stop' || headers[15] !== 'current_stop') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetsId,
        range: 'Buses!O1:P1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['next_stop', 'current_stop']] }
      });
      clearCache('Buses!A1:P1');
      clearCache('Buses!A:P');
      clearCache('Buses!A:O');
      clearCache('Buses!A:N');
    }
    hasEnsuredBusHeaders = true;
  } catch (err) {
    console.error('Failed to ensure bus headers:', err.message);
  }
}

export async function getBuses() {
  const now = Date.now();
  if (now - busesCache.timestamp < CACHE_TTL_MS) return busesCache.list;
  await ensureBusNextStopHeader();
  const rows = await getSheetData('Buses!A:P');
  const list = rowsToObjects(rows);
  const map = new Map();
  list.forEach(b => map.set(busNumberKey(b.bus_number), b));
  busesCache = { timestamp: now, map, list };
  return list;
}

export async function updateBusMorningStart(busNumber, time) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!I${sheetRow}:L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[time, '', 'morning', 'morning_running']] },
  });
  await appendAuditLog('bus_started_morning', busNumber, time);
  buses[rowIndex].morning_start_time = time;
  buses[rowIndex].return_start_time = '';
  buses[rowIndex].journey_type = 'morning';
  buses[rowIndex].current_status = 'morning_running';
  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}

export async function updateBusReturnStart(busNumber, time) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!J${sheetRow}:L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[time, 'return', 'return_running']] },
  });
  buses[rowIndex].return_start_time = time;
  buses[rowIndex].journey_type = 'return';
  buses[rowIndex].current_status = 'return_running';
  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}

export async function updateStudentFeeStatus(studentId, feeStatus, feeDueDate = '') {
  const students = await getStudents();
  const rowIndex = students.findIndex((s) => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');
  const sheets = await getSheets();
  const sheetRow = students[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Students!H${sheetRow}:J${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[feeStatus, feeDueDate, feeDueDate]] },
  });
  
  if (studentsCache.map && studentsCache.map.has(studentId)) {
    const s = studentsCache.map.get(studentId);
    s.fee_status = feeStatus;
    s.fee_due_date = feeDueDate;
    s.fee_paid_until = feeDueDate;
  }
  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

export async function updateBusLocation(busNumber, lat, lng) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  
  const now = new Date().toISOString();
  
  // 1. Instantly update in-memory cache so subsequent polls get live coordinates immediately
  buses[rowIndex].latitude = String(lat);
  buses[rowIndex].longitude = String(lng);
  buses[rowIndex].current_lat = String(lat);
  buses[rowIndex].current_lng = String(lng);
  buses[rowIndex].last_updated = now;
  if (busesCache.map) {
    busesCache.map.set(busNumberKey(busNumber), buses[rowIndex]);
  }

  // 2. Persist to Google Sheets
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!F${sheetRow}:H${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[String(lat), String(lng), now]] },
  });
}

export async function getDashboardStats() {
  const [students, todayAttendance, buses] = await Promise.all([
    getStudents(),
    getTodayAttendance(),
    getBuses()
  ]);

  const activeBuses = buses.filter(b => {
    if (!b.last_updated) return false;
    const updated = new Date(b.last_updated);
    return (Date.now() - updated.getTime()) < 60 * 60 * 1000;
  }).length;

  const today = getISTDateString();
  const feeDefaultersList = students.filter((s) => {
    let isDue = (s.fee_status || '').toUpperCase() === 'DUE';
    if (s.fee_paid_until && s.fee_paid_until.trim() !== '') {
      isDue = s.fee_paid_until < today;
    }
    return isDue;
  });
  const feeDefaulters = feeDefaultersList.length;

  const feeDefaultersBoarded = todayAttendance
    .filter((r) => r.scan_type === 'boarding')
    .filter((r) => {
      const student = students.find((s) => s.student_id === r.student_id);
      if (!student) return false;
      let isDue = (student.fee_status || '').toUpperCase() === 'DUE';
      if (student.fee_paid_until && student.fee_paid_until.trim() !== '') {
        isDue = student.fee_paid_until < today;
      }
      return isDue;
    })
    .map((r) => {
      const student = students.find((s) => s.student_id === r.student_id);
      return {
        student_id: r.student_id,
        student_name: r.student_name,
        actual_bus: r.actual_bus || r.bus_number,
        boarded_at: r.boarded_at,
        parent_whatsapp: student?.parent_whatsapp || 'N/A'
      };
    });

  return {
    totalStudents: students.length,
    boardedToday: todayAttendance.filter(r => r.scan_type === 'boarding').length,
    droppedOffToday: todayAttendance.filter(r => r.scan_type === 'dropoff').length,
    activeBuses,
    buses: buses.length,
    feeDefaulters,
    feeDefaultersBoarded,
    activeReassignments: [],
    incidents: [],
    allIncidents: [],
    driverPerformance: [],
    notDroppedOff: []
  };
}

export async function updateBusDriverDetails(busNumber, name, phone) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!B${sheetRow}:C${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[name, phone]] },
  });
  busesCache.timestamp = 0;
}

export async function getBusByNumber(busNumber) {
  const key = busNumberKey(busNumber);
  const now = Date.now();
  if (now - busesCache.timestamp < CACHE_TTL_MS && busesCache.map.has(key)) {
    return busesCache.map.get(key);
  }
  await getBuses();
  return busesCache.map.get(key);
}

export async function getAttendance(dateFilter = null) {
  const rows = await getSheetData('Attendance!A:H');
  const records = rowsToObjects(rows);
  if (!dateFilter) return records;
  return records.filter((r) => r.date === dateFilter);
}

export async function getTodayAttendance() {
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();
  if (
    todayAttendanceCache.date === today &&
    now - todayAttendanceCache.timestamp < CACHE_TTL_MS
  ) {
    return todayAttendanceCache.records;
  }
  const records = await getAttendance(today);
  todayAttendanceCache = { date: today, timestamp: now, records };
  return records;
}

export async function appendAttendance(record) {
  const sheets = await getSheets();
  const values = [[
    record.timestamp,
    record.student_id,
    record.student_name,
    record.bus_number,
    record.stop_name,
    record.boarded_at,
    record.driver_name,
    record.date,
    record.notification_status || '',
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Attendance!A:I',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

export async function updateNotificationStatus(studentId, date, status) {
  const rows = await getSheetData('Attendance!A:I');
  const records = rowsToObjects(rows);
  const rowIndex = records.findIndex(
    (r) => r.student_id === studentId && r.date === date
  );
  if (rowIndex === -1) return;

  const sheets = await getSheets();
  const sheetRow = records[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Attendance!I${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
}

export function clearCache(key) {
  if (key) {
    delete cache[key];
    if (key.startsWith('Attendance')) invalidateTodayAttendanceCache();
  } else {
    for (let k in cache) delete cache[k];
    invalidateTodayAttendanceCache();
  }
}

export async function appendAuditLog(actionType, target, newValue, reason = '') {
  try {
    const sheets = await getSheets();
    const values = [[
      new Date().toISOString(),
      actionType,
      target,
      newValue,
      reason
    ]];
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetsId,
      range: 'AuditLog!A:E',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
}
export async function updateBusMorningStop(busNumber, time) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!K${sheetRow}:L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['idle', 'idle']] },
  });
  await appendAuditLog('bus_stopped_morning', busNumber, time);
  buses[rowIndex].journey_type = 'idle';
  buses[rowIndex].current_status = 'idle';
  buses[rowIndex].morning_end_time = time;
  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}

export async function updateBusReturnStop(busNumber, time) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!K${sheetRow}:L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['idle', 'idle']] },
  });
  buses[rowIndex].journey_type = 'idle';
  buses[rowIndex].current_status = 'idle';
  buses[rowIndex].return_end_time = time;
  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}

export async function bulkUpdateFeePaidUntil(studentIds, feePaidUntil) {
  const students = await getStudents();
  const sheets = await getSheets();
  const data = [];
  studentIds.forEach(id => {
    const rowIndex = students.findIndex(s => s.student_id === id);
    if (rowIndex !== -1) {
      const sheetRow = students[rowIndex]._sheetRow;
      data.push({
        range: `Students!H${sheetRow}:J${sheetRow}`,
        values: [['PAID', feePaidUntil, feePaidUntil]]
      });
    }
  });
  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.googleSheetsId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: data
      }
    });
    clearCache('Students!A:M');
    studentsCache.timestamp = 0; // Invalidate cache
  }
}

export async function updateStudentBusNumber(studentId, busNumber) {
  const students = await getStudents();
  const rowIndex = students.findIndex(s => s.student_id === studentId);
  if (rowIndex === -1) return;
  const sheets = await getSheets();
  const sheetRow = students[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Students!D${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[busNumber]] }
  });
  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

export async function getIncidents() {
  const rows = await getSheetData('Incidents!A:G');
  return rowsToObjects(rows);
}



export async function appendStudent(s) {
  const sheets = await getSheets();
  const values = [[
    s.student_id,
    s.name,
    s.class,
    s.bus_number,
    s.stop_name,
    s.parent_name,
    s.parent_whatsapp,
    s.fee_status,
    '', // fee_due_date (unused)
    s.fee_paid_until,
    s.lookup_phone_last4,
    'ACTIVE'
  ]];
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A:M',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  
  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

export async function updateStudentStatus(studentId, status) {
  const students = await getStudents();
  const rowIndex = students.findIndex(s => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');
  const sheets = await getSheets();
  const sheetRow = students[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Students!L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] }
  });
  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

export async function updateStudentFcmToken(studentId, fcmToken) {
  console.log(`[Sheets] Attempting to update FCM token for student: ${studentId}`);
  try {
    const students = await getStudents();
    const rowIndex = students.findIndex(s => s.student_id === studentId);
    if (rowIndex === -1) {
      throw new Error(`Student ${studentId} not found in database`);
    }
    const sheets = await getSheets();
    const sheetRow = students[rowIndex]._sheetRow;
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetsId,
      range: `Students!M${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fcmToken]] }
    });
    clearCache('Students!A:M');
    studentsCache.timestamp = 0;
    console.log(`[Sheets] Successfully wrote FCM token to row ${sheetRow} for student ${studentId}`);
  } catch (err) {
    console.error(`[Sheets] Failed to write FCM token for student ${studentId}:`, err.message);
    throw err;
  }
}

export async function deleteStudent(studentId) {
  const students = await getStudents();
  const rowIndex = students.findIndex(s => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');
  const sheets = await getSheets();
  const sheetRow = students[rowIndex]._sheetRow;
  
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === 'Students');
  if (!sheet) throw new Error('Students sheet not found');
  const sheetId = sheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow - 1,
              endIndex: sheetRow
            }
          }
        }
      ]
    }
  });

  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

async function ensureTabExists(sheets, title, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: config.googleSheetsId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleSheetsId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetsId,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

export async function startJourneyLog(busNumber, driverName, fuelReading, reason) {
  const sheets = await getSheets();
  const headers = ['date', 'bus_number', 'driver_name', 'reason', 'start_time', 'end_time', 'start_fuel', 'end_fuel', 'timestamp'];
  await ensureTabExists(sheets, 'Journey_Logs', headers);
  
  const today = getISTDateString();
  const row = [
    today,
    busNumber,
    driverName || 'Driver',
    reason,
    new Date().toISOString(), // start_time
    '', // end_time
    fuelReading,
    '', // end_fuel
    new Date().toISOString()
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Journey_Logs!A:I',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  clearCache('Journey_Logs!A:I');
}

export async function stopJourneyLog(busNumber, fuelReading) {
  const sheets = await getSheets();
  const headers = ['date', 'bus_number', 'driver_name', 'reason', 'start_time', 'end_time', 'start_fuel', 'end_fuel', 'timestamp'];
  await ensureTabExists(sheets, 'Journey_Logs', headers);

  const rows = await getSheetData('Journey_Logs!A:I');
  if (!rows || rows.length <= 1) {
    throw new Error('No journey logs found to stop');
  }
  const logs = rowsToObjects(rows);
  const activeLog = [...logs].reverse().find(log => String(log.bus_number) === String(busNumber) && (!log.end_time || log.end_time.trim() === ''));
  
  const sheetRow = activeLog ? activeLog._sheetRow : [...logs].reverse().find(log => String(log.bus_number) === String(busNumber))?._sheetRow;
  if (!sheetRow) throw new Error('No journey log found for this bus');

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Journey_Logs!F${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[new Date().toISOString()]] }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Journey_Logs!H${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[fuelReading]] }
  });
  clearCache('Journey_Logs!A:I');
}

export async function updateBusNextStop(busNumber, stopName) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) return;
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!O${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[stopName]] }
  });
  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}

export async function updateBusStopsState(busNumber, currentStopName, nextStopName) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) return;
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!O${sheetRow}:P${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[nextStopName, currentStopName]] }
  });
  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}

let driveClient = null;
export async function getDrive() {
  if (!driveClient) {
    const auth = getAuth();
    driveClient = google.drive({ version: 'v3', auth });
  }
  return driveClient;
}

export async function processOdometerUpload(busNumber, base64Image, driverName, reason = 'Others', manualReading = '', refueled = 'FALSE', liters = '') {
  const sheets = await getSheets();
  const drive = await getDrive();

  // Ensure tab exists with new headers
  const headers = ['timestamp', 'date', 'bus_number', 'photo_url', 'extracted_reading', 'logged_by', 'reason', 'odometer_reading', 'refueled', 'liters'];
  await ensureTabExists(sheets, 'Fuel_Odometer_Logs', headers);

  // Extract base64 binary content
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Format file name based on date and time
  const today = getISTDateString();
  const rawTime = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const timeFormatted = rawTime.replace(/:/g, '-');
  const fileName = `${today}_${timeFormatted}_${busNumberKey(busNumber)}_${reason.replace(/\s+/g, '_')}.jpg`;

  let driveUrl = '';
  // 1. Upload to Drive (with local filesystem fallback)
  try {
    const fileMetadata = {
      name: fileName,
      ...(config.googleDriveFolderId ? { parents: [config.googleDriveFolderId] } : {})
    };
    const media = {
      mimeType: 'image/jpeg',
      body: Readable.from(buffer)
    };

    const driveFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    const fileId = driveFile.data.id;
    driveUrl = driveFile.data.webViewLink;

    // Make readable by anyone
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true
    });
  } catch (err) {
    console.warn(`[Drive] Google Drive upload failed: ${err.message}. Saving locally as fallback.`);
    try {
      const fs = await import('fs');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'public/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      const serverUrl = (process.env.SERVER_URL || 'http://localhost:3002').replace(/\/$/, '');
      driveUrl = `${serverUrl}/uploads/${fileName}`;
      console.log(`[Drive] Local fallback success. Saved to: ${filePath}`);
    } catch (fsErr) {
      console.error('[Drive] Local fallback failed:', fsErr.message);
      driveUrl = '';
    }
  }

  // 2. Perform OCR via Google Cloud Vision API
  let extractedReading = '0';
  try {
    const authClient = getAuth();
    const tokenRes = await authClient.getAccessToken();
    const accessToken = tokenRes.token;

    const ocrResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: 'TEXT_DETECTION' }]
          }
        ]
      })
    });

    const ocrData = await ocrResponse.json();
    const textAnnotations = ocrData.responses?.[0]?.textAnnotations;
    const fullText = textAnnotations?.[0]?.description || '';

    if (fullText) {
      const lines = fullText.split('\n');
      for (const line of lines) {
        const match = line.replace(/\s/g, '').match(/\b\d{4,7}\b/);
        if (match) {
          extractedReading = match[0];
          break;
        }
      }
      if (extractedReading === '0') {
        const generalMatch = fullText.replace(/\s/g, '').match(/\d{4,7}/);
        if (generalMatch) extractedReading = generalMatch[0];
      }
    }
  } catch (err) {
    console.error('OCR failed:', err.message);
  }

  // 3. Log to Sheet
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Fuel_Odometer_Logs!A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        today,
        busNumber,
        driveUrl,
        extractedReading,
        driverName || 'Driver',
        reason,
        manualReading || extractedReading,
        String(refueled).toUpperCase(),
        liters ? String(liters) : ''
      ]]
    }
  });

  clearCache('Fuel_Odometer_Logs!A:J');

  return { extractedReading, driveUrl };
}

export async function getOdometerStats(busNumber = null) {
  const rows = await getSheetData('Fuel_Odometer_Logs!A:J');
  if (!rows || rows.length <= 1) {
    return busNumber ? { currentOdometer: 0, lastRefuelDate: null, daysSinceLastRefuel: null, mileage: 0, logs: [] } : { stats: {}, logs: [] };
  }

  const logs = rowsToObjects(rows);
  
  // Sort logs by timestamp ascending
  logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const calculateBusStats = (busLogs, busNo) => {
    if (busLogs.length === 0) {
      return { bus_number: busNo, currentOdometer: 0, lastRefuelDate: null, daysSinceLastRefuel: null, mileage: 0, totalLogs: 0 };
    }

    // Latest odometer reading (manual reading or fallback to extracted_reading)
    const latestLog = busLogs[busLogs.length - 1];
    const currentOdometer = Number(latestLog.odometer_reading || latestLog.extracted_reading || 0);

    // Last refuel log
    const refuelLogs = busLogs.filter(log => String(log.refueled).toUpperCase() === 'TRUE');
    const latestRefuel = refuelLogs[refuelLogs.length - 1];
    const lastRefuelDate = latestRefuel ? latestRefuel.date : null;

    let daysSinceLastRefuel = null;
    if (lastRefuelDate) {
      const today = new Date(getISTDateString());
      const lastRefuel = new Date(lastRefuelDate);
      const diffTime = Math.abs(today - lastRefuel);
      daysSinceLastRefuel = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate Mileage (km/L)
    let mileage = 0;
    let totalDistance = 0;
    let totalLiters = 0;

    // Sort refuel logs ascending
    refuelLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (let i = 1; i < refuelLogs.length; i++) {
      const prev = refuelLogs[i - 1];
      const curr = refuelLogs[i];

      const prevOdo = Number(prev.odometer_reading || prev.extracted_reading || 0);
      const currOdo = Number(curr.odometer_reading || curr.extracted_reading || 0);
      const liters = Number(curr.liters || 0);

      if (currOdo > prevOdo && liters > 0) {
        totalDistance += (currOdo - prevOdo);
        totalLiters += liters;
      }
    }

    if (totalLiters > 0) {
      mileage = Number((totalDistance / totalLiters).toFixed(2));
    }

    return {
      bus_number: busNo,
      currentOdometer,
      lastRefuelDate,
      daysSinceLastRefuel,
      mileage,
      totalLogs: busLogs.length
    };
  };

  if (busNumber) {
    const busNoKey = busNumberKey(busNumber);
    const busLogs = logs.filter(log => busNumberKey(log.bus_number) === busNoKey);
    const stats = calculateBusStats(busLogs, busNumber);
    stats.logs = busLogs.map(log => ({
      timestamp: log.timestamp,
      date: log.date,
      reason: log.reason || 'Others',
      reading: Number(log.odometer_reading || log.extracted_reading || 0),
      photo_url: log.photo_url,
      refueled: String(log.refueled).toUpperCase() === 'TRUE',
      liters: log.liters ? Number(log.liters) : null,
      logged_by: log.logged_by
    })).reverse();
    return stats;
  } else {
    const buses = [...new Set(logs.map(log => log.bus_number))];
    const allStats = {};
    buses.forEach(b => {
      const busLogs = logs.filter(log => log.bus_number === b);
      allStats[b] = calculateBusStats(busLogs, b);
    });
    return {
      stats: allStats,
      logs: logs.map(log => ({
        timestamp: log.timestamp,
        date: log.date,
        bus_number: log.bus_number,
        reason: log.reason || 'Others',
        reading: Number(log.odometer_reading || log.extracted_reading || 0),
        photo_url: log.photo_url,
        refueled: String(log.refueled).toUpperCase() === 'TRUE',
        liters: log.liters ? Number(log.liters) : null,
        logged_by: log.logged_by
      })).reverse().slice(0, 100)
    };
  }
}

export async function runOcrOnImage(base64Image) {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  let extractedReading = '0';
  try {
    const authClient = getAuth();
    const tokenRes = await authClient.getAccessToken();
    const accessToken = tokenRes.token;

    const ocrResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: 'TEXT_DETECTION' }]
          }
        ]
      })
    });

    const ocrData = await ocrResponse.json();
    const textAnnotations = ocrData.responses?.[0]?.textAnnotations;
    const fullText = textAnnotations?.[0]?.description || '';

    if (fullText) {
      const lines = fullText.split('\n');
      for (const line of lines) {
        const match = line.replace(/\s/g, '').match(/\b\d{4,7}\b/);
        if (match) {
          extractedReading = match[0];
          break;
        }
      }
      if (extractedReading === '0') {
        const generalMatch = fullText.replace(/\s/g, '').match(/\d{4,7}/);
        if (generalMatch) extractedReading = generalMatch[0];
      }
    }
  } catch (err) {
    console.error('OCR failed:', err.message);
  }
  return extractedReading;
}

export async function assignStudentQr(studentId, newQrId) {
  const students = await getStudents();
  
  // 1. Check if the new QR is already in use by another student
  const duplicate = students.find(s => s.student_id === newQrId);
  if (duplicate) {
    throw new Error(`This QR code is already assigned to ${duplicate.name} (${duplicate.class})`);
  }

  // 2. Find the target student
  const rowIndex = students.findIndex(s => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');
  
  const sheets = await getSheets();
  const sheetRow = students[rowIndex]._sheetRow;

  // 3. Update Column A (student_id) with the new QR ID!
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Students!A${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[newQrId]] }
  });

  // 4. Invalidate cache
  clearCache('Students!A:M');
  studentsCache.timestamp = 0;
}

let stopsCache = { timestamp: 0, list: [] };

export async function getRouteStops() {
  const now = Date.now();
  if (now - stopsCache.timestamp < 3000) return stopsCache.list;
  
  const sheets = await getSheets();
  const headers = ['id', 'bus_number', 'stop_name', 'latitude', 'longitude', 'sequence'];
  await ensureTabExists(sheets, 'Route_Stops', headers);
  
  const rows = await getSheetData('Route_Stops!A:F');
  if (!rows || rows.length <= 1) {
    stopsCache = { timestamp: now, list: [] };
    return [];
  }
  const list = rowsToObjects(rows);
  stopsCache = { timestamp: now, list };
  return list;
}

export async function addRouteStop(stop) {
  const sheets = await getSheets();
  const headers = ['id', 'bus_number', 'stop_name', 'latitude', 'longitude', 'sequence'];
  await ensureTabExists(sheets, 'Route_Stops', headers);

  const row = [
    stop.id || `STOP_${Date.now()}`,
    stop.bus_number,
    stop.stop_name,
    String(stop.latitude),
    String(stop.longitude),
    String(stop.sequence)
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Route_Stops!A:F',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  
  clearCache('Route_Stops!A:F');
  stopsCache.timestamp = 0;
}

export async function deleteRouteStop(stopId) {
  const stops = await getRouteStops();
  const rowIndex = stops.findIndex(s => s.id === stopId);
  if (rowIndex === -1) throw new Error('Stop not found');
  
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2; // +2 for header and 0-index offset

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === 'Route_Stops');
  if (!sheet) throw new Error('Route_Stops sheet not found');
  const sheetId = sheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow - 1,
              endIndex: sheetRow
            }
          }
        }
      ]
    }
  });

  clearCache('Route_Stops!A:F');
  stopsCache.timestamp = 0;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

export async function checkGeofenceNextStop(busNumber, lat, lng) {
  try {
    const stops = await getRouteStops();
    const busStops = stops
      .filter(s => String(s.bus_number) === String(busNumber))
      .sort((a, b) => Number(a.sequence) - Number(b.sequence));

    if (busStops.length === 0) return;

    for (const stop of busStops) {
      const stopLat = Number(stop.latitude);
      const stopLng = Number(stop.longitude);
      if (isNaN(stopLat) || isNaN(stopLng)) continue;

      const dist = getDistanceKm(lat, lng, stopLat, stopLng);
      // If within 150 meters
      if (dist < 0.15) {
        console.log(`[Geofence] Bus ${busNumber} reached stop: ${stop.stop_name} (dist: ${(dist * 1000).toFixed(0)}m)`);
        
        const currentSeq = Number(stop.sequence);
        const nextStopObj = busStops.find(s => Number(s.sequence) > currentSeq);
        
        const currentStopName = stop.stop_name;
        const nextStopName = nextStopObj ? nextStopObj.stop_name : 'Trip Completed';

        console.log(`[Geofence] Setting current to "${currentStopName}" and next to "${nextStopName}" for Bus ${busNumber}`);
        await updateBusStopsState(busNumber, currentStopName, nextStopName);
        break;
      }
    }
  } catch (err) {
    console.error('[Geofence] check failed:', err.message);
  }
}

export async function addBus(bus) {
  const buses = await getBuses();
  const duplicate = buses.find(b => busNumberKey(b.bus_number) === busNumberKey(bus.bus_number));
  if (duplicate) {
    throw new Error(`Bus ${bus.bus_number} already exists`);
  }

  const sheets = await getSheets();
  const row = [
    bus.bus_number,
    bus.driver_name || '',
    bus.driver_phone || '',
    bus.route_name || '',
    bus.capacity || '50',
    '', // lat
    '', // lng
    '', // last updated
    '', // morning start
    '', // return start
    'idle', // journey type
    'idle', // status
    '', // morning end
    '', // return end
    '', // next stop
    ''  // current stop
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Buses!A:P',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });

  clearCache('Buses!A:P');
  busesCache.timestamp = 0;
}


