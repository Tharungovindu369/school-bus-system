// MISSING LINE 1
// MISSING LINE 2
// MISSING LINE 3
// MISSING LINE 4
// MISSING LINE 5
// MISSING LINE 6
// MISSING LINE 7
// MISSING LINE 8
// MISSING LINE 9
// MISSING LINE 10
// MISSING LINE 11
// MISSING LINE 12
// MISSING LINE 13
// MISSING LINE 14
// MISSING LINE 15
// MISSING LINE 16
// MISSING LINE 17
// MISSING LINE 18
// MISSING LINE 19
// MISSING LINE 20
// MISSING LINE 21
// MISSING LINE 22
// MISSING LINE 23
// MISSING LINE 24
// MISSING LINE 25
// MISSING LINE 26
// MISSING LINE 27
// MISSING LINE 28
// MISSING LINE 29
// MISSING LINE 30
// MISSING LINE 31
// MISSING LINE 32
// MISSING LINE 33
// MISSING LINE 34
// MISSING LINE 35
// MISSING LINE 36
// MISSING LINE 37
// MISSING LINE 38
// MISSING LINE 39
// MISSING LINE 40
// MISSING LINE 41
// MISSING LINE 42
// MISSING LINE 43
// MISSING LINE 44
// MISSING LINE 45
// MISSING LINE 46
// MISSING LINE 47
// MISSING LINE 48
// MISSING LINE 49
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
// MISSING LINE 101
// MISSING LINE 102
// MISSING LINE 103
// MISSING LINE 104
// MISSING LINE 105
// MISSING LINE 106
// MISSING LINE 107
// MISSING LINE 108
// MISSING LINE 109
// MISSING LINE 110
// MISSING LINE 111
// MISSING LINE 112
// MISSING LINE 113
// MISSING LINE 114
// MISSING LINE 115
// MISSING LINE 116
// MISSING LINE 117
// MISSING LINE 118
// MISSING LINE 119
// MISSING LINE 120
// MISSING LINE 121
// MISSING LINE 122
// MISSING LINE 123
// MISSING LINE 124
// MISSING LINE 125
// MISSING LINE 126
// MISSING LINE 127
// MISSING LINE 128
// MISSING LINE 129
// MISSING LINE 130
// MISSING LINE 131
// MISSING LINE 132
// MISSING LINE 133
// MISSING LINE 134
// MISSING LINE 135
// MISSING LINE 136
// MISSING LINE 137
// MISSING LINE 138
// MISSING LINE 139
// MISSING LINE 140
// MISSING LINE 141
// MISSING LINE 142
// MISSING LINE 143
// MISSING LINE 144
// MISSING LINE 145
// MISSING LINE 146
// MISSING LINE 147
// MISSING LINE 148
// MISSING LINE 149
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
// MISSING LINE 211
// MISSING LINE 212
// MISSING LINE 213
// MISSING LINE 214
// MISSING LINE 215
// MISSING LINE 216
// MISSING LINE 217
// MISSING LINE 218
// MISSING LINE 219
// MISSING LINE 220
// MISSING LINE 221
// MISSING LINE 222
// MISSING LINE 223
// MISSING LINE 224
// MISSING LINE 225
// MISSING LINE 226
// MISSING LINE 227
// MISSING LINE 228
// MISSING LINE 229
// MISSING LINE 230
// MISSING LINE 231
// MISSING LINE 232
// MISSING LINE 233
// MISSING LINE 234
// MISSING LINE 235
// MISSING LINE 236
// MISSING LINE 237
// MISSING LINE 238
// MISSING LINE 239
// MISSING LINE 240
// MISSING LINE 241
// MISSING LINE 242
// MISSING LINE 243
// MISSING LINE 244
// MISSING LINE 245
// MISSING LINE 246
// MISSING LINE 247
// MISSING LINE 248
// MISSING LINE 249
// MISSING LINE 250
// MISSING LINE 251
// MISSING LINE 252
// MISSING LINE 253
// MISSING LINE 254
// MISSING LINE 255
// MISSING LINE 256
// MISSING LINE 257
// MISSING LINE 258
// MISSING LINE 259
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
// MISSING LINE 291
// MISSING LINE 292
// MISSING LINE 293
// MISSING LINE 294
// MISSING LINE 295
// MISSING LINE 296
// MISSING LINE 297
// MISSING LINE 298
// MISSING LINE 299
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
// MISSING LINE 351
// MISSING LINE 352
// MISSING LINE 353
// MISSING LINE 354
// MISSING LINE 355
// MISSING LINE 356
// MISSING LINE 357
// MISSING LINE 358
// MISSING LINE 359
// MISSING LINE 360
// MISSING LINE 361
// MISSING LINE 362
// MISSING LINE 363
// MISSING LINE 364
// MISSING LINE 365
// MISSING LINE 366
// MISSING LINE 367
// MISSING LINE 368
// MISSING LINE 369
// MISSING LINE 370
// MISSING LINE 371
// MISSING LINE 372
// MISSING LINE 373
// MISSING LINE 374
// MISSING LINE 375
// MISSING LINE 376
// MISSING LINE 377
// MISSING LINE 378
// MISSING LINE 379
// MISSING LINE 380
// MISSING LINE 381
// MISSING LINE 382
// MISSING LINE 383
// MISSING LINE 384
// MISSING LINE 385
// MISSING LINE 386
// MISSING LINE 387
// MISSING LINE 388
// MISSING LINE 389
// MISSING LINE 390
// MISSING LINE 391
// MISSING LINE 392
// MISSING LINE 393
// MISSING LINE 394
// MISSING LINE 395
// MISSING LINE 396
// MISSING LINE 397
// MISSING LINE 398
// MISSING LINE 399
// MISSING LINE 400
// MISSING LINE 401
// MISSING LINE 402
// MISSING LINE 403
// MISSING LINE 404
// MISSING LINE 405
// MISSING LINE 406
// MISSING LINE 407
// MISSING LINE 408
// MISSING LINE 409
// MISSING LINE 410
// MISSING LINE 411
// MISSING LINE 412
// MISSING LINE 413
// MISSING LINE 414
// MISSING LINE 415