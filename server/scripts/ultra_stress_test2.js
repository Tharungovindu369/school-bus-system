import fetch from 'node-fetch';
import http from 'http';
import { getSheets } from '../services/sheets.js';
import { config } from '../config.js';

const API_URL = 'http://localhost:3002/api';
const TOTAL_BUSES = 44;
const STUDENTS_PER_BUS = 170;

const httpAgent = new http.Agent({ maxSockets: 500, keepAlive: true });

async function run() {
  const sheets = await getSheets();
  const spreadsheetId = config.googleSheetsId;

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

  console.log(`Prepared ${scans.length} scans. Executing with controlled concurrency...`);
  
  const startTime = Date.now();
  let completed = 0;
  let successes = 0;
  let failures = 0;
  let duplicateRejections = 0;
  let quotaErrors = 0;
  const responseTimes = [];

  const CONCURRENCY = 150;
  
  async function worker(queue) {
    while (queue.length > 0) {
      const scan = queue.pop();
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
        
        if (res.ok) successes++;
        else {
          const body = await res.json();
          if (body.error && body.error.includes('already been scanned')) duplicateRejections++;
          else failures++;
        }
      } catch (e) {
        failures++;
        if (e.message.includes('429') || e.message.includes('quota')) quotaErrors++;
      }
      completed++;
      if (completed % 1000 === 0) console.log(`Progress: ${completed}/${scans.length} completed`);
    }
  }

  const workers = [];
  const queue = [...scans];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(queue));
  }
  await Promise.all(workers);

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
  }
}

run().catch(console.error);
