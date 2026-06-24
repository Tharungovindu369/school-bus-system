import { google } from 'googleapis';
import { config } from '../config.js';
import { getISTDateString } from '../utils.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

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
    last4
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A:K',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  studentsCache.timestamp = 0;
}

export async function getStudents() {
  const now = Date.now();
  if (now - studentsCache.timestamp < CACHE_TTL_MS) return studentsCache.list;
  const rows = await getSheetData('Students!A:K');
  const list = rowsToObjects(rows);
  const map = new Map();
  list.forEach(s => map.set(s.student_id, s));
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

export async function getBuses() {
  const now = Date.now();
  if (now - busesCache.timestamp < CACHE_TTL_MS) return busesCache.list;
  const rows = await getSheetData('Buses!A:N');
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
  clearCache('Buses!A:N');
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
  clearCache('Buses!A:N');
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
  clearCache('Students!A:K');
  studentsCache.timestamp = 0;
}

export async function updateBusLocation(busNumber, lat, lng) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = buses[rowIndex]._sheetRow;
  const now = new Date().toISOString();
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
  clearCache('Buses!A:N');
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
  clearCache('Buses!A:N');
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
    clearCache('Students!A:K');
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
  clearCache('Students!A:K');
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
    s.lookup_phone_last4
  ]];
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A:K',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  
  clearCache('Students!A:K');
  studentsCache.timestamp = 0;
}
