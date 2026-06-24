const { google } = require('googleapis');
const { config } = require('../config.js');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function cleanupTests() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: SCOPES,
  });
  const sheets = google.sheets({ version: 'v4', auth });
  
  const todayStr = '2026-06-23';
  
  // 1. Clean Attendance
  const attRes = await sheets.spreadsheets.values.get({ spreadsheetId: config.googleSheetsId, range: 'Attendance!A:I' });
  const attRows = attRes.data.values || [];
  
  const keepAttRows = [];
  let deletedAttCount = 0;
  for (let i = 0; i < attRows.length; i++) {
    const row = attRows[i];
    if (i === 0) { keepAttRows.push(row); continue; }
    // Date is at index 7 (Column H)
    if (row[7] === todayStr) {
      deletedAttCount++;
    } else {
      keepAttRows.push(row);
    }
  }
  
  if (deletedAttCount > 0) {
    await sheets.spreadsheets.values.clear({ spreadsheetId: config.googleSheetsId, range: 'Attendance!A2:I' });
    if (keepAttRows.length > 1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetsId,
        range: 'Attendance!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: keepAttRows },
      });
    }
    console.log(`Deleted ${deletedAttCount} test records from Attendance.`);
  } else {
    console.log('No test records found in Attendance.');
  }
  
  // 2. Clean Incidents
  const incRes = await sheets.spreadsheets.values.get({ spreadsheetId: config.googleSheetsId, range: 'Incidents!A:I' });
  const incRows = incRes.data.values || [];
  
  const keepIncRows = [];
  let deletedIncCount = 0;
  for (let i = 0; i < incRows.length; i++) {
    const row = incRows[i];
    if (i === 0) { keepIncRows.push(row); continue; }
    // Date is at index 0 (Column A)
    if (row[0] === todayStr) {
      deletedIncCount++;
    } else {
      keepIncRows.push(row);
    }
  }
  
  if (deletedIncCount > 0) {
    await sheets.spreadsheets.values.clear({ spreadsheetId: config.googleSheetsId, range: 'Incidents!A2:I' });
    if (keepIncRows.length > 1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetsId,
        range: 'Incidents!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: keepIncRows },
      });
    }
    console.log(`Deleted ${deletedIncCount} test records from Incidents.`);
  } else {
    console.log('No test records found in Incidents.');
  }

}

cleanupTests().catch(console.error);
