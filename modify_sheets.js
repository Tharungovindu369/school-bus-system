const fs = require('fs');
let code = fs.readFileSync('server/services/sheets.js', 'utf8');

// 1. Students Map
const studentsMapBlock = `let studentsCache = null;
let studentsCacheMap = null;
let studentsByBusCacheMap = null;
let studentsCacheTime = 0;
export async function getStudents() {
  if (studentsCache && Date.now() - studentsCacheTime < CACHE_TTL) return studentsCache;
  const rows = await getSheetData('Students!A:K');
  const records = rowsToObjects(rows).map((r) => ({
    ...r,
    fee_paid_until: parseSheetDate(r.fee_paid_until),
    bus_number: formatBusNumber(r.bus_number),
    lookup_phone_last4: r.lookup_phone_last4 || '',
  }));
  studentsCache = records;
  studentsCacheMap = new Map();
  studentsByBusCacheMap = new Map();
  for (const s of records) {
    studentsCacheMap.set(s.student_id, s);
    const bKey = busNumberKey(s.bus_number);
    if (!studentsByBusCacheMap.has(bKey)) studentsByBusCacheMap.set(bKey, []);
    studentsByBusCacheMap.get(bKey).push(s);
  }
  studentsCacheTime = Date.now();
  return records;
}

export async function getStudentById(studentId) {
  await getStudents();
  return studentsCacheMap.get(studentId);
}

export async function getStudentsByBus(busNumber) {
  await getStudents();
  return studentsByBusCacheMap.get(busNumberKey(busNumber)) || [];
}`;
code = code.replace(/let studentsCache = null;[\s\S]*?return students\.filter\(\(s\) => busNumberKey\(s\.bus_number\) === key\);\s*}/, studentsMapBlock);

// 2. Buses Map
const busesMapBlock = `let busesCache = null;
let busesCacheMap = null;
let busesCacheTime = 0;
export async function getBuses() {
  if (busesCache && Date.now() - busesCacheTime < CACHE_TTL) return busesCache;
  const { revertExpiredReassignments } = await import('./reassignments.js');
  await revertExpiredReassignments();
  const rows = await getSheetData('Buses!A:N');
  const records = rowsToObjects(rows).map((b) => ({
    ...b,
    bus_number: formatBusNumber(b.bus_number),
    journey_type: b.journey_type || 'idle',
    current_status: b.current_status || 'idle',
  }));
  busesCache = records;
  busesCacheMap = new Map();
  for (const b of records) {
    busesCacheMap.set(busNumberKey(b.bus_number), b);
  }
  busesCacheTime = Date.now();
  return records;
}

export async function getBusByNumber(busNumber) {
  await getBuses();
  return busesCacheMap.get(busNumberKey(busNumber));
}`;
code = code.replace(/let busesCache = null;[\s\S]*?return buses\.find\(\(b\) => busNumberKey\(b\.bus_number\) === key\);\s*}/, busesMapBlock);

// 3. Attendance Map
const attMapBlock = `let attendanceCache = null;
let attendanceCacheMap = null;
let attendanceStudentDateMap = null;
let attendanceCacheTime = 0;

const parseAttendanceRecord = (r) => ({
  ...r,
  is_cross_bus: r.is_cross_bus === 'TRUE',
});

export async function getAttendance(dateFilter = null) {
  if (!attendanceCache || Date.now() - attendanceCacheTime > CACHE_TTL) {
    const rows = await getSheetData('Attendance!A:P');
    const records = rowsToObjects(rows).map(parseAttendanceRecord);
    attendanceCache = {
      headers: rows[0] || [],
      records: records,
    };
    attendanceCacheMap = new Map();
    attendanceStudentDateMap = new Map();
    for (const r of records) {
      const bKey = busNumberKey(r.bus_number);
      const sType = r.scan_type || 'boarding';
      attendanceCacheMap.set(r.student_id + '_' + r.date + '_' + sType + '_' + bKey, r);
      if (sType === 'college_arrival') {
        attendanceCacheMap.set(r.student_id + '_' + r.date + '_college_arrival', r);
      }
      
      const sdKey = r.student_id + '_' + r.date;
      if (!attendanceStudentDateMap.has(sdKey)) attendanceStudentDateMap.set(sdKey, []);
      attendanceStudentDateMap.get(sdKey).push(r);
    }
    attendanceCacheTime = Date.now();
  }

  let queueRecords = [];
  if (attendanceQueue.length > 0 && attendanceCache.headers.length > 0) {
    const queueRowsWithHeaders = [attendanceCache.headers, ...attendanceQueue];
    queueRecords = rowsToObjects(queueRowsWithHeaders).map(parseAttendanceRecord);
  }

  const allRecords = [...attendanceCache.records, ...queueRecords];
  if (!dateFilter) return allRecords;
  return allRecords.filter((r) => r.date === dateFilter);
}

export async function findAttendanceRecord(studentId, busNumber, date, scanType) {
  await getAttendance();
  const busKey = busNumberKey(busNumber);
  
  const queueRow = attendanceQueue.find(row => 
    row[1] === studentId && 
    busNumberKey(row[3]) === busKey && 
    row[7] === date && 
    (row[9] || 'boarding') === scanType
  );
  if (queueRow) {
    const queueRowsWithHeaders = [attendanceCache.headers, queueRow];
    return rowsToObjects(queueRowsWithHeaders).map(parseAttendanceRecord)[0];
  }

  if (scanType === 'college_arrival') {
    return attendanceCacheMap.get(studentId + '_' + date + '_college_arrival');
  }
  return attendanceCacheMap.get(studentId + '_' + date + '_' + scanType + '_' + busKey);
}

export async function hasDriverScanToday(studentId, date = getISTDateString()) {
  await getAttendance();
  
  const queueRow = attendanceQueue.find(row => 
    row[1] === studentId && 
    row[7] === date && 
    (row[9] === 'boarding' || row[9] === 'return_boarding' || row[9] === '')
  );
  if (queueRow) return true;

  const records = attendanceStudentDateMap.get(studentId + '_' + date);
  if (!records) return false;
  return records.some(r => r.scan_type === 'boarding' || r.scan_type === 'return_boarding');
}`;
code = code.replace(/let attendanceCache = null;[\s\S]*?r\.scan_type === 'boarding' \|\| r\.scan_type === 'return_boarding'\r?\n\s*\);\r?\n}/, attMapBlock);

fs.writeFileSync('server/services/sheets.js', code);
console.log('Modified sheets.js successfully!');
