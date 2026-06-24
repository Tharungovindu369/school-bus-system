import { getSheets } from './services/sheets.js';
import { config } from './config.js';

async function run() {
  try {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.googleSheetsId, range: 'Attendance!A:H' });
    const length = res.data.values ? res.data.values.length : 0;
    if (length > 1) {
       await sheets.spreadsheets.values.clear({ spreadsheetId: config.googleSheetsId, range: `Attendance!A2:I${length}` });
       console.log('Cleared', length - 1, 'rows');
    } else {
       console.log('Nothing to clear');
    }
  } catch (err) {
    console.error(err);
  }
}
run();
