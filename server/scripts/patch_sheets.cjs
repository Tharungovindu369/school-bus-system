const fs = require('fs');

let content = fs.readFileSync('services/sheets.js', 'utf8');

content = content.replace(/'Students!A:I'/g, "'Students!A:K'");
content = content.replace(/range: \`Students!D\$\{sheetRow\}\`/g, "range: \`Students!D\${sheetRow}\`"); // just making sure it stays intact

const appendCode = `
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
`;

content += appendCode;
fs.writeFileSync('services/sheets.js', content);
console.log('sheets.js updated successfully');
