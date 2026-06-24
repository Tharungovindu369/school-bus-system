import fetch from 'node-fetch';
import http from 'http';
import https from 'https';
import { getSheets } from '../services/sheets.js';
import { config } from '../config.js';

const API_URL = 'http://localhost:3002/api';
const TOTAL_BUSES = 44;
const STUDENTS_PER_BUS = 170;
const DURATION_SEC = 15;

const httpAgent = new http.Agent({ maxSockets: 500 });

async function run() {
  const sheets = await getSheets();
  const spreadsheetId = config.googleSheetsId;

  console.log('1. Generating synthetic data...');
  const syntheticBuses = [];
  for (let i = 14; i <= TOTAL_BUSES; i++) {
    syntheticBuses.push([
      `Bus ${i}`, `Driver ${i}`, `9999`, 'active', '0.0', '0.0', '0', '0', '1', '', '', 'idle', '', ''
    ]);
  }
  
  const syntheticStudents = [];
  let synthId = 1;
  for (let i = 14; i <= TOTAL_BUSES; i++) {
    for (let j = 0; j < STUDENTS_PER_BUS; j++) {
      const sId = `SYNTH_${synthId++}`;
      syntheticStudents.push([
        sId, `Synth Student ${sId}`, `Class 1`, `Bus ${i}`, `Stop 1`, `Parent ${sId}`, `910000000000`, `PAID`, ``, `2026-12-31`, `0000`
      ]);
    }
  }

  console.log(`Writing ${syntheticBuses.length} buses and ${syntheticStudents.length} students to sheets...`);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Buses!A:N',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: syntheticBuses }
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Students!A:K',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: syntheticStudents }
  });

  console.log('Waiting 65 seconds for server cache to expire...');
  await new Promise(resolve => setTimeout(resolve, 65000));

  console.log('Fetching all students and buses from API...');
  const [studentsRes, busesRes] = await Promise.all([
    fetch(`${API_URL}/students`),
    fetch(`${API_URL}/buses`)
  ]);

  const students = await studentsRes.json();
  const buses = await busesRes.json();
  console.log(`Loaded ${students.length} students, ${buses.length} buses.`);

  // Prepare scans
  const scans = [];
  for (let i = 1; i <= TOTAL_BUSES; i++) {
    const busNumber = `Bus ${i}`;
    const busStudents = students.filter(s => s.bus_number === busNumber);
    busStudents.forEach(student => {
      const isCrossBus = Math.random() < 0.1;
      let targetBus = busNumber;
      if (isCrossBus) {
        targetBus = `Bus ${Math.floor(Math.random() * TOTAL_BUSES) + 1}`;
      }
      scans.push({
        student_id: student.student_id,
        bus_number: targetBus,
        driver_name: `Driver ${targetBus}`,
        scan_type: Math.random() < 0.1 ? 'manual' : 'boarding',
        scan_mode: 'morning'
      });
    });
  }

  // Shuffle scans
  scans.sort(() => 0.5 - Math.random());
  
  // Duplicate injection (5%)
  const duplicateCount = Math.floor(scans.length * 0.05);
  for (let i=0; i<duplicateCount; i++) {
    scans.push({ ...scans[i], scan_type: 'boarding' });
  }
  scans.sort(() => 0.5 - Math.random());

  console.log(`Prepared ${scans.length} scans. Firing over ${DURATION_SEC} seconds...`);
  
  const startTime = Date.now();
  let completed = 0;
  let successes = 0;
  let failures = 0;
  let duplicateRejections = 0;
  let quotaErrors = 0;
  const responseTimes = [];

  const promises = scans.map((scan, index) => {
    return new Promise(resolve => {
      const delay = Math.random() * (DURATION_SEC * 1000);
      setTimeout(async () => {
        const reqStart = Date.now();
        try {
          const res = await fetch(`${API_URL}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scan),
            agent: httpAgent
          });
          const time = Date.now() - reqStart;
          responseTimes.push(time);
          completed++;
          
          if (res.ok) successes++;
          else {
            const body = await res.json();
            if (body.error && body.error.includes('already been scanned')) duplicateRejections++;
            else failures++;
          }
        } catch (e) {
          failures++;
          completed++;
          if (e.message.includes('429') || e.message.includes('quota')) quotaErrors++;
        }
        if (completed % 1000 === 0) console.log(`Progress: ${completed}/${scans.length} completed`);
        resolve();
      }, delay);
    });
  });

  await Promise.all(promises);
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log('\n--- ULTRA STRESS TEST RESULTS ---');
  console.log(`Total Requests: ${scans.length}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures: ${failures} (Duplicates caught: ${duplicateRejections})`);
  console.log(`Quota Errors: ${quotaErrors}`);
  console.log(`Time Taken: ${totalTime.toFixed(2)}s (${(scans.length / totalTime).toFixed(2)} req/sec)`);
  
  if (responseTimes.length > 0) {
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxTime = Math.max(...responseTimes);
    console.log(`Avg Response: ${avgTime.toFixed(2)}ms`);
    console.log(`Max Response: ${maxTime}ms`);
  } else {
    console.log("No response times recorded.");
  }

  // Verification
  console.log('\nWaiting 10s for write queues to flush...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  const finalAttRes = await fetch(`${API_URL}/attendance`);
  const finalAtt = await finalAttRes.json();
  const finalCount = finalAtt.filter(a => a.date === new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'}).split(',')[0] || a.date === '2026-06-21').length;
  console.log(`Final Attendance rows today: ${finalCount}`);

  // Cleanup
  console.log('\nCleaning up synthetic data...');
  // We must delete the rows we added.
  const allStudents = (await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Students!A:K' })).data.values;
  const allBuses = (await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Buses!A:N' })).data.values;
  const allAtt = (await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Attendance!A:P' })).data.values;

  const getDeletes = (rows, matchFn, sheetTitle) => {
    if (!rows) return [];
    let toDelete = [];
    for (let i = rows.length - 1; i >= 1; i--) {
      if (matchFn(rows[i])) toDelete.push(i);
    }
    return { toDelete, sheetTitle };
  };

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const getSheetId = (title) => spreadsheet.data.sheets.find(s => s.properties.title === title).properties.sheetId;

  const stuDeletes = getDeletes(allStudents, row => row[0]?.startsWith('SYNTH_'), 'Students');
  const busDeletes = getDeletes(allBuses, row => row[0]?.startsWith('Bus ') && parseInt(row[0].split(' ')[1]) >= 14, 'Buses');
  const attDeletes = getDeletes(allAtt, row => row[1]?.startsWith('SYNTH_'), 'Attendance');

  const requests = [];
  const addDeletes = ({ toDelete, sheetTitle }) => {
    const sheetId = getSheetId(sheetTitle);
    toDelete.forEach(rowIndex => {
      requests.push({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
        }
      });
    });
  };
  addDeletes(stuDeletes);
  addDeletes(busDeletes);
  addDeletes(attDeletes);

  if (requests.length > 0) {
    console.log(`Deleting ${requests.length} synthetic rows...`);
    const CHUNK = 1000;
    for (let i = 0; i < requests.length; i += CHUNK) {
      const chunk = requests.slice(i, i + CHUNK);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: chunk }
      });
    }
    console.log('Cleanup complete.');
  }
}

run().catch(console.error);
