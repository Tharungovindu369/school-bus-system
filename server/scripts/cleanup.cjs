require('dotenv').config();
const { google } = require('googleapis');
const config = require('../config.js');

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(config.googleCredentials),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function cleanup() {
  const sheets = await getSheets();
  const spreadsheetId = config.googleSheetsId;
  
  // Clean Students
  const stdReq = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Students!A:A' });
  const stdRows = stdReq.data.values || [];
  let stdDeletes = [];
  for (let i = stdRows.length - 1; i >= 1; i--) {
    if (stdRows[i][0] && stdRows[i][0].startsWith('TEST_QA_')) {
      stdDeletes.push({
        deleteDimension: {
          range: { sheetId: 0, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } // Note: we need the actual sheetId for Students
        }
      });
    }
  }

  // Get exact Sheet IDs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIds = {};
  meta.data.sheets.forEach(s => sheetIds[s.properties.title] = s.properties.sheetId);

  // Map sheetIds to requests
  stdDeletes.forEach(req => req.deleteDimension.range.sheetId = sheetIds['Students']);

  // Same for Incidents and Attendance if they involve TEST_QA_
  const incReq = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Incidents!C:C' });
  const incRows = incReq.data.values || [];
  for (let i = incRows.length - 1; i >= 1; i--) {
    if (incRows[i][0] && incRows[i][0].startsWith('TEST_QA_')) {
      stdDeletes.push({
        deleteDimension: { range: { sheetId: sheetIds['Incidents'], dimension: 'ROWS', startIndex: i, endIndex: i + 1 } }
      });
    }
  }

  const attReq = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Attendance!C:C' });
  const attRows = attReq.data.values || [];
  for (let i = attRows.length - 1; i >= 1; i--) {
    if (attRows[i][0] && attRows[i][0].startsWith('TEST_QA_')) {
      stdDeletes.push({
        deleteDimension: { range: { sheetId: sheetIds['Attendance'], dimension: 'ROWS', startIndex: i, endIndex: i + 1 } }
      });
    }
  }

  if (stdDeletes.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: stdDeletes }
    });
    console.log(`Cleaned up ${stdDeletes.length} test rows.`);
  } else {
    console.log('No test rows found to clean up.');
  }
}

cleanup().catch(console.error);
