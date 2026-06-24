import { getSheets, getSheetData } from '../services/sheets.js';
import { config } from '../config.js';
import { parseSheetDate } from '../utils.js';

async function migrateFeeDates() {
  console.log('Fetching students...');
  const rows = await getSheetData('Students!A:J');
  if (!rows || rows.length === 0) {
    console.log('No data found.');
    return;
  }

  const updates = [];

  // Start from 1 to skip headers
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const feeDueDate = row[8]; // Column I
    const feePaidUntil = row[9]; // Column J

    if (!feePaidUntil && feeDueDate) {
      const parsedDate = parseSheetDate(feeDueDate);
      if (parsedDate) {
        // Prepare update for column J (fee_paid_until)
        // Sheet rows are 1-indexed, so row i in array corresponds to sheet row i + 1
        const sheetRow = i + 1;
        updates.push({
          range: `Students!J${sheetRow}`,
          values: [[parsedDate]],
        });
      }
    }
  }

  console.log(`Found ${updates.length} rows to update.`);

  if (updates.length > 0) {
    console.log('Sending batch update to Google Sheets...');
    const sheets = await getSheets();
    const batchData = updates.map(update => ({
      range: update.range,
      values: update.values,
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.googleSheetsId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    });
    console.log('Migration successful!');
  } else {
    console.log('No migration needed.');
  }
}

migrateFeeDates().catch(console.error);
