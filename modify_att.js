const fs = require('fs');
let code = fs.readFileSync('server/services/sheets.js', 'utf8');

const regex = /let attendanceCache = null;[\s\S]*?\(r\.scan_type === 'boarding' \|\| r\.scan_type === 'return_boarding'\)\r?\n\s*\);\r?\n\s*}/;

const attMapBlock = `let attendanceCache = null;
let attendanceCacheMap = null;
let attendanceStudentDateMap = null;
let attendanceCacheTime = 0;

const parseAttendanceRecord = (r) => ({
  ...r,
  date: parseSheetDate(r.date),
  boarded_at: parseSheetTime(r.boarded_at),
  dropoff_time: parseSheetTime(r.dropoff_time),
  arrival_time: parseSheetTime(r.arrival_time),
  bus_number: formatBusNumber(r.bus_number),
  actual_bus: r.actual_bus ? formatBusNumber(r.actual_bus) : '',
  assigned_bus: r.assigned_bus ? formatBusNumber(r.assigned_bus) : '',
  scan_type: r.scan_type || 'boarding',
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

export async function getTodayAttendance() {
  return getAttendance(getISTDateString());
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

if (code.match(regex)) {
  code = code.replace(regex, attMapBlock);
  fs.writeFileSync('server/services/sheets.js', code);
  console.log('Attendance map replaced successfully!');
} else {
  console.log('Regex did not match!');
}
