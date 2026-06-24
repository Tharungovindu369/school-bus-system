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

export async function getStudents() {
  const rows = await getSheetData('Students!A:I');
  return rowsToObjects(rows);
}

export async function getStudentById(studentId) {
  const students = await getStudents();
  return students.find((s) => s.student_id === studentId);
}

export async function getStudentsByBus(busNumber) {
  const students = await getStudents();
  return students.filter((s) => busNumberKey(s.default_bus) === busNumberKey(busNumber) || busNumberKey(s.assigned_bus) === busNumberKey(busNumber) || busNumberKey(s.bus_number) === busNumberKey(busNumber));
}

export async function getBuses() {
  const rows = await getSheetData('Buses!A:N');
  return rowsToObjects(rows);
}

export async function updateBusMorningStart(busNumber, time) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!I${sheetRow}:L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[time, '', 'morning', 'morning_running']] },
  });
  await appendAuditLog('bus_started_morning', busNumber, time);
}

export async function updateBusReturnStart(busNumber, time) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
}

export async function updateBusDriverDetails(busNumber, name, phone) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!B${sheetRow}:C${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[name, phone]] },
  });
}

export async function getBusByNumber(busNumber) {
  const buses = await getBuses();
  return buses.find((b) => busNumberKey(b.bus_number) === busNumberKey(busNumber));
}

export async function getAttendance(dateFilter = null) {
  const rows = await getSheetData('Attendance!A:H');
  const records = rowsToObjects(rows);
  if (!dateFilter) return records;
  return records.filter((r) => r.date === dateFilter);
}

export async function getTodayAttendance() {
  const today = new Date().toISOString().split('T')[0];
  return getAttendance(today);
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

export async function updateStudentFeeStatus(studentId, feeStatus) {
  const students = await getStudents();
  const rowIndex = students.findIndex((s) => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');
  const feeDefaulters = students.filter(
    (s) => (s.fee_status || '').toUpperCase() === 'DUE'
  ).length;

  const activeBuses = buses.filter((b) => {
    if (!b.last_updated) return false;
    const updated = new Date(b.last_updated);
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return updated.getTime() > hourAgo;
  }).length;

  const feeDefaultersBoarded = todayAttendance
    .filter((r) => ['boarding', 'return_boarding'].includes(r.scan_type))
    .filter((r) => {
      const student = students.find((s) => s.student_id === r.student_id);
      return student && (student.fee_status || '').toUpperCase() === 'DUE';
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
    buses: buses.length,
    feeDefaultersBoarded,
    activeReassignments: [],
    incidents: todayIncidents,
    allIncidents: [],
    driverPerformance: [],
    notDroppedOff: [],
  };
}

export async function updateNotificationStatus(studentId, date, status) {
  const rows = await getSheetData('Attendance!A:I');
  const records = rowsToObjects(rows);
  const rowIndex = records.findIndex(
    (r) => r.student_id === studentId && r.date === date
  );
  if (rowIndex === -1) return;

  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Attendance!I${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
}

export function clearCache(key) {}

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