export async function updateBusLocation(busNumber, lat, lng) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex((b) => String(b.bus_number) === String(busNumber));
  if (rowIndex === -1) throw new Error('Bus not found');
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  const now = new Date().toISOString();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!F${sheetRow}:H${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[String(lat), String(lng), now]] },
  });
}

export async function updateBusMorningStop(busNumber, driverName) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex(b => String(b.bus_number) === String(busNumber));
  if (rowIndex === -1) return;
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!K${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[new Date().toISOString()]] },
  });
}

export async function updateBusReturnStop(busNumber, driverName) {
  const buses = await getBuses();
  const rowIndex = buses.findIndex(b => String(b.bus_number) === String(busNumber));
  if (rowIndex === -1) return;
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Buses!L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[new Date().toISOString()]] },
  });
}

export async function bulkUpdateFeePaidUntil(studentIds, feePaidUntil) {
  const students = await getStudents();
  const sheets = await getSheets();
  const data = [];
  studentIds.forEach(id => {
    const rowIndex = students.findIndex(s => s.student_id === id);
    if (rowIndex !== -1) {
      const sheetRow = rowIndex + 2;
      data.push({
        range: `Students!H${sheetRow}:I${sheetRow}`,
        values: [['PAID', feePaidUntil]]
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
  }
}

export async function updateStudentBusNumber(studentId, busNumber) {
  const students = await getStudents();
  const rowIndex = students.findIndex(s => s.student_id === studentId);
  if (rowIndex === -1) return;
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Students!D${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[busNumber]] }
  });
}

export async function getIncidents() {
  const rows = await getSheetData('Incidents!A:G');
  return rowsToObjects(rows);
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

  return {
    totalStudents: students.length,
    boardedToday: todayAttendance.filter(r => r.scan_type === 'boarding').length,
    droppedOffToday: todayAttendance.filter(r => r.scan_type === 'dropoff').length,
    activeBuses,
    buses: buses.length,
    feeDefaultersBoarded: 0,
    activeReassignments: [],
    incidents: [],
    allIncidents: [],
    driverPerformance: [],
    notDroppedOff: []
  };
}
