const fs = require('fs');
let c = fs.readFileSync('D:/school-bus-system/server/services/sheets.js', 'utf8');

const search = `export async function getDashboardStats() {
  const [students, todayAttendance, buses] = await Promise.all([
    getStudents(),
    getTodayAttendance(),
    getBuses(),
  ]);

  const feeDefaulters = students.filter(
    (s) => (s.fee_status || '').toUpperCase() === 'DUE'
  ).length;

  const activeBuses = buses.filter((b) => {
    if (!b.last_updated) return false;
    const updated = new Date(b.last_updated);
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return updated.getTime() > hourAgo;
  }).length;

  return {
    totalStudents: students.length,
    boardedToday: todayAttendance.length,
    feeDefaulters,
    activeBuses,
    buses: buses.length,
  };
}`;

const replace = `export async function getIncidents(dateFilter = null) {
  const rows = await getSheetData('Incidents!A:H');
  const records = rowsToObjects(rows);
  if (dateFilter) {
    return records.filter(r => r.date === dateFilter);
  }
  return records;
}

export async function getDashboardStats() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [students, todayAttendance, buses, todayIncidents] = await Promise.all([
    getStudents(),
    getTodayAttendance(),
    getBuses(),
    getIncidents(today),
  ]);

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
    feeDefaulters,
    activeBuses,
    buses: buses.length,
    feeDefaultersBoarded,
    activeReassignments: [],
    incidents: todayIncidents,
    allIncidents: [],
    driverPerformance: [],
    notDroppedOff: [],
  };
}`;

if (!c.includes(search)) {
  console.log('Search string not found!');
  process.exit(1);
}
c = c.replace(search, replace);
fs.writeFileSync('D:/school-bus-system/server/services/sheets.js', c);
console.log('Replaced');
