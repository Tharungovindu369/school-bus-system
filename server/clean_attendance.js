import { google } from 'googleapis';
import fs from 'fs';
import { getSheets } from './services/sheets.js';
import { config } from './config.js';

async function cleanupAttendance() {
  const sheets = await getSheets();
  const spreadsheetId = config.googleSheetsId;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Attendance!A:P' });
  const values = res.data.values;
  if (!values || values.length <= 1) return console.log('Nothing to clean.');
  
  const header = values[0];
  const validRows = values.slice(1).filter(row => row[0] && row[0].trim() !== '');
  
  console.log(`Original rows: ${values.length}, Valid rows: ${validRows.length}`);
  
  // Clear the whole sheet (except header)
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `Attendance!A2:Z` });
  
  if (validRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Attendance!A2:P',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: validRows }
    });
  }
  console.log('Cleanup complete!');
}

cleanupAttendance().catch(console.error);
