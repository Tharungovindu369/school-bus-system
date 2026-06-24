import { getSheets } from '../services/sheets.js';
import { config } from '../config.js';

async function cleanup() {
  const sheets = await getSheets();
  const spreadsheetId = config.googleSheetsId;
  
  // Get exact Sheet IDs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIds = {};
  meta.data.sheets.forEach(s => sheetIds[s.properties.title] = s.properties.sheetId);

  let deletes = [];

  const addDeletes = async (sheetName, range, prefix) => {
    const req = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = req.data.values || [];
    // We must loop backwards to avoid shifting indices when deleting!
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] && rows[i][0].startsWith(prefix)) {
        deletes.push({
          deleteDimension: {
            range: { sheetId: sheetIds[sheetName], dimension: 'ROWS', startIndex: i, endIndex: i + 1 }
          }
        });
      }
    }
  };

  await addDeletes('Students', 'Students!A:A', 'TEST_QA_');
  await addDeletes('Incidents', 'Incidents!C:C', 'TEST_QA_'); // student_id is col C
  await addDeletes('Attendance', 'Attendance!C:C', 'TEST_QA_'); // student_id is col C

  if (deletes.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: deletes }
    });
    console.log(`Cleaned up ${deletes.length} test rows.`);
  } else {
    console.log('No test rows found to clean up.');
  }
}

cleanup().catch(console.error);
