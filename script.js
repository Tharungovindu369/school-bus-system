const fs = require('fs');
let c = fs.readFileSync('D:/school-bus-system/server/services/sheets.js', 'utf8');
const search = `  const crossBusBoardings = todayAttendance
    .filter(
      (r) =>
        ['boarding', 'return_boarding'].includes(r.scan_type) &&
        String(r.is_cross_bus).toUpperCase() === 'TRUE'
    )
    .map((r) => ({
      student_id: r.student_id,
      student_name: r.student_name,
      assigned_bus: r.assigned_bus || r.bus_number,
      actual_bus: r.actual_bus || r.bus_number,
      boarded_at: r.boarded_at,
    }));`;

const replace = `  const feeDefaultersBoarded = todayAttendance
    .filter((r) => ['boarding', 'return_boarding'].includes(r.scan_type))
    .filter((r) => {
      const student = students.find((s) => s.student_id === r.student_id);
      return student && isFeeDue(student, today);
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
    });`;

c = c.replace(search, replace);
c = c.replace('crossBusBoardings,', 'feeDefaultersBoarded,');

fs.writeFileSync('D:/school-bus-system/server/services/sheets.js', c);
console.log('Replaced');
