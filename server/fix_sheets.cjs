const fs = require('fs');
let t = fs.readFileSync('services/sheets.js', 'utf8');
const start = t.indexOf('export async function updateStudentFeeStatus');
const end = t.indexOf('export async function', start + 10);
const replacement = `export async function updateStudentFeeStatus(studentId, feeStatus, feeDueDate = '') {
  const students = await getStudents();
  const rowIndex = students.findIndex((s) => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');
  const sheets = await getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: \`Students!H\${sheetRow}:I\${sheetRow}\`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[feeStatus, feeDueDate]] },
  });
}

`;
t = t.substring(0, start) + replacement + t.substring(end);
fs.writeFileSync('services/sheets.js', t);
