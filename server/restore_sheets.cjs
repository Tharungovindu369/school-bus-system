const fs = require('fs');
let code = fs.readFileSync('server/services/sheets.js', 'utf8');

const missingFuncs = `
export async function appendIncident(record) {
  const sheets = await getSheets();
  const values = [[
    record.date,
    record.student_id,
    record.student_name,
    record.bus_number,
    record.driver_name,
    record.incident_type,
    record.details,
    record.timestamp
  ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: 'Incidents!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function bulkUpdateFeePaidUntil(studentIds, paidUntil) {
  const sheets = await getSheets();
  const students = await getStudents();
  
  const updates = [];
  for (const id of studentIds) {
    const rowIndex = students.findIndex(s => s.student_id === id);
    if (rowIndex !== -1) {
      // Assuming Fee Status is col H and Paid Until is col I
      // rowIndex + 2 for 1-based index with header
      updates.push({
        range: \`Students!I\${rowIndex + 2}\`,
        values: [[paidUntil]]
      });
    }
  }
  
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates
      }
    });
  }
}

export async function updateStudentBusNumber(studentId, busNumber) {
  const sheets = await getSheets();
  const students = await getStudents();
  const rowIndex = students.findIndex((s) => s.student_id === studentId);
  if (rowIndex === -1) throw new Error('Student not found');

  // Assuming Bus Number is column D (index 3)
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: \`Students!D\${rowIndex + 2}\`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[busNumber]] },
  });
}
`;

if (!code.includes('appendIncident')) {
  code += '\n' + missingFuncs;
  fs.writeFileSync('server/services/sheets.js', code);
  console.log('Added missing functions to sheets.js');
}
