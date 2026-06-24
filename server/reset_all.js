import { getSheets } from './services/sheets.js';
import { config } from './config.js';
import fs from 'fs';

async function run() {
  try {
    const sheets = await getSheets();
    const spId = config.googleSheetsId;
    
    // Clear Attendance
    const att = await sheets.spreadsheets.values.get({ spreadsheetId: spId, range: 'Attendance!A2:J1000' });
    if (att.data.values && att.data.values.length > 0) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: spId, range: 'Attendance!A2:J1000' });
      console.log(`Cleared ${att.data.values.length} rows from Attendance`);
    } else {
      console.log('Attendance was already empty.');
    }
    
    // Clear Incidents
    const inc = await sheets.spreadsheets.values.get({ spreadsheetId: spId, range: 'Incidents!A2:H1000' });
    if (inc.data.values && inc.data.values.length > 0) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: spId, range: 'Incidents!A2:H1000' });
      console.log(`Cleared ${inc.data.values.length} rows from Incidents`);
    } else {
      console.log('Incidents was already empty.');
    }
    
    // Clear Reassignments
    const reas = await sheets.spreadsheets.values.get({ spreadsheetId: spId, range: 'Driver_Reassignments!A2:H1000' });
    if (reas.data.values && reas.data.values.length > 0) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: spId, range: 'Driver_Reassignments!A2:H1000' });
      console.log(`Cleared ${reas.data.values.length} rows from Driver_Reassignments`);
    } else {
      console.log('Driver_Reassignments was already empty.');
    }
    
    // Reset Buses
    const buses = await sheets.spreadsheets.values.get({ spreadsheetId: spId, range: 'Buses!A2:I1000' });
    const busValues = buses.data.values;
    if (busValues) {
      const newBuses = busValues.map(row => {
        return [row[0], '', '', row[3] || '', row[4] || '', '', '', 'idle', ''];
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: spId,
        range: 'Buses!A2:I' + (busValues.length + 1),
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newBuses }
      });
      console.log('Reset Buses');
    }

    // Reset Students Fee status (PAID and clear dates)
    const students = await sheets.spreadsheets.values.get({ spreadsheetId: spId, range: 'Students!A2:K1000' });
    const studentValues = students.data.values;
    if (studentValues) {
      const newStudents = studentValues.map(row => {
        // H is row[7], I is row[8], J is row[9]
        const newRow = [...row];
        newRow[7] = 'PAID';
        newRow[8] = ''; // fee_due_date
        newRow[9] = ''; // fee_paid_until
        return newRow;
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: spId,
        range: 'Students!A2:K' + (studentValues.length + 1),
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newStudents }
      });
      console.log('Reset Student Fees');
    }

    // Clear Queues
    fs.writeFileSync('data/queue_backup.json', JSON.stringify({ attendanceQueue: [], incidentQueue: [] }));
    console.log('Cleared JSON Queues');
    
    console.log('Reset complete!');
  } catch(e) {
    console.error(e);
  }
}

run();
