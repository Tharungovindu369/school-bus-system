import { getSheets, getSheetData } from '../services/sheets.js';
import { config } from '../config.js';

async function run() {
  const sheets = await getSheets();
  const rows = await getSheetData('Students!A:K');
  
  if (!rows || rows.length === 0) {
    console.log("No data found.");
    return;
  }
  
  // Update header if needed
  if (!rows[0][10] || rows[0][10] !== 'lookup_phone_last4') {
    rows[0][10] = 'lookup_phone_last4';
  }
  
  let updatedCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    while (row.length < 11) {
      row.push('');
    }
    const whatsapp = String(row[6] || '').replace(/\D/g, '');
    let last4 = '';
    if (whatsapp && whatsapp.length >= 4) {
      last4 = whatsapp.slice(-4);
    }
    
    // Only update if it doesn't already have a valid one
    // Actually, force migrate everything since this is a one-time migration
    row[10] = last4;
    updatedCount++;
  }
  
  console.log(`Writing ${rows.length} rows to Students!A:K...`);
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A:K',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  
  console.log(`Migration complete. Updated ${updatedCount} students.`);
}

run().catch(console.error);
