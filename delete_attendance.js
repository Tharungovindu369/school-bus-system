const { getSheets, getSheetData, clearCache } = require('./server/services/sheets.js');
const { config } = require('./server/config.js');

async function run() {
  const sheets = await getSheets();
  const rows = await getSheetData('Attendance!A:P');
  
  if (!rows || rows.length === 0) {
    console.log("No attendance data found.");
    return;
  }
  
  const headers = rows[0];
  const dateColIndex = headers.indexOf('date');
  
  if (dateColIndex === -1) {
    console.log("Error: Could not find 'date' column in Attendance sheet.");
    return;
  }
  
  let toDelete = [];
  // Start from 1 to skip header
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][dateColIndex] === '2026-06-20') {
      toDelete.push(i);
    }
  }
  
  console.log(`Found ${toDelete.length} rows with date = '2026-06-20'.`);
  
  if (toDelete.length === 0) return;
  
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: config.googleSheetsId });
  const sheetId = spreadsheet.data.sheets.find(s => s.properties.title === 'Attendance').properties.sheetId;
  
  // Sort in reverse order to delete without shifting indices
  toDelete.sort((a, b) => b - a);
  
  const requests = toDelete.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex,     // 0-based index
        endIndex: rowIndex + 1    // exclusive
      }
    }
  }));
  
  console.log("Deleting rows...");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: { requests }
  });
  
  clearCache('Attendance!A:P');
  console.log("Deletion complete.");
}

run().catch(console.error);
