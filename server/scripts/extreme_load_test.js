import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002/api';
const TOTAL_BUSES = 13;
const SCANS_PER_BUS = 40;

async function runTest() {
  console.log('Fetching initial students and buses...');
  const [studentsRes, busesRes, attendanceRes] = await Promise.all([
    fetch(`${API_URL}/students`),
    fetch(`${API_URL}/buses`),
    fetch(`${API_URL}/attendance`)
  ]);

  const students = await studentsRes.json();
  const buses = await busesRes.json();
  const initialAttendance = await attendanceRes.json();
  const initialAttendanceCount = initialAttendance.length;

  console.log(`Fetched ${students.length} students, ${buses.length} buses. Initial attendance rows: ${initialAttendanceCount}`);

  // Generate scenarios
  const scans = [];
  
  for (let i = 1; i <= TOTAL_BUSES; i++) {
    const busNumber = `Bus ${i}`;
    const busStudents = students.filter(s => s.bus_number === busNumber);
    // shuffle busStudents
    busStudents.sort(() => 0.5 - Math.random());
    
    // Pick ~40 students
    const selectedStudents = busStudents.slice(0, SCANS_PER_BUS);
    
    selectedStudents.forEach(student => {
      // 10% chance to be cross bus
      const isCrossBus = Math.random() < 0.1;
      let targetBus = busNumber;
      if (isCrossBus) {
        targetBus = `Bus ${Math.floor(Math.random() * TOTAL_BUSES) + 1}`;
      }
      
      const scanType = Math.random() < 0.1 ? 'manual' : 'boarding';
      
      scans.push({
        student_id: student.student_id,
        bus_number: targetBus,
        driver_name: `Driver ${targetBus}`,
        scan_type: scanType,
        scan_mode: 'morning'
      });
      
      // 5% chance of duplicate
      if (Math.random() < 0.05) {
        scans.push({
          student_id: student.student_id,
          bus_number: targetBus,
          driver_name: `Driver ${targetBus}`,
          scan_type: scanType,
          scan_mode: 'morning'
        });
      }
    });
  }
  
  // shuffle all scans to simulate concurrent random hits
  scans.sort(() => 0.5 - Math.random());
  
  console.log(`Prepared ${scans.length} total scan requests.`);
  
  let successCount = 0;
  let failCount = 0;
  let duplicateCount = 0;
  let crossBusCount = 0;
  let errors = {};
  let totalTime = 0;
  let slowest = 0;
  
  console.log('Firing all scans in a 2-second rush window...');
  
  const startTime = Date.now();
  
  const scanPromises = scans.map(async (req, index) => {
    // Stagger scans uniformly over 2000ms (2 seconds)
    const delay = (index / scans.length) * 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    const start = Date.now();
    try {
      const res = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      const data = await res.json();
      const time = Date.now() - start;
      totalTime += time;
      if (time > slowest) slowest = time;
      
      if (res.status === 200) {
        successCount++;
        if (data.duplicate) duplicateCount++;
        if (data.isCrossBus) crossBusCount++;
      } else {
        failCount++;
        let errMsg = data.error || `HTTP ${res.status}`;
        if (errMsg.includes('Quota exceeded')) errMsg = 'Quota Exceeded (Write Limit)';
        errors[errMsg] = (errors[errMsg] || 0) + 1;
      }
    } catch (err) {
      const time = Date.now() - start;
      totalTime += time;
      if (time > slowest) slowest = time;
      failCount++;
      const fullErr = [
        err.message,
        err.code ? `code: ${err.code}` : null,
        err.errno ? `errno: ${err.errno}` : null,
        err.type ? `type: ${err.type}` : null,
      ].filter(Boolean).join(' | ');
      errors[fullErr] = (errors[fullErr] || 0) + 1;
    }
  });

  // Also fire dashboard requests
  const dashboardPromises = [];
  let dashboardErrors = 0;
  for (let i = 0; i < 4; i++) {
    dashboardPromises.push(new Promise(resolve => {
      setTimeout(async () => {
        try {
          const res = await fetch(`${API_URL}/dashboard`, {
             headers: { 'x-admin-password': 'admin123' }
          });
          if (!res.ok) throw new Error(`Dashboard HTTP ${res.status}`);
        } catch (err) {
          dashboardErrors++;
          errors[`Dashboard error: ${err.message}`] = (errors[`Dashboard error: ${err.message}`] || 0) + 1;
        }
        resolve();
      }, Math.random() * 5000); // spread over 5 seconds
    }));
  }

  await Promise.all([...scanPromises, ...dashboardPromises]);
  
  const endTime = Date.now();
  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
  const avgTime = (totalTime / scans.length).toFixed(2);
  
  console.log(`\nSimulation finished in ${elapsedSeconds}s! Fetching final state...`);
  
  // wait 5 seconds for any async tasks or sheets writes to flush (setInterval is 3000ms)
  await new Promise(r => setTimeout(r, 5000));
  // bypass cache for final verification
  const finalAttendanceRes = await fetch(`${API_URL}/attendance?bypass=true`);
  const finalAttendance = await finalAttendanceRes.json();
  const finalAttendanceCount = finalAttendance.length;
  
  const rowsAdded = finalAttendanceCount - initialAttendanceCount;
  
  // Evaluate PASS / FAIL
  const hasQuotaErrors = Object.keys(errors).some(k => k.includes('Quota Exceeded'));
  const isTimePass = avgTime < 2000;
  
  console.log('\n=== EXTREME LOAD TEST RESULTS ===');
  console.table({
    "Total Requests Sent": scans.length,
    "Successful Responses (200 OK)": successCount,
    "Failed Responses": failCount,
    "Average Response Time (ms)": avgTime,
    "Slowest Response Time (ms)": slowest,
    "Duplicate Scans Detected": duplicateCount,
    "Cross-Bus Scans Detected": crossBusCount,
    "Initial Attendance Rows": initialAttendanceCount,
    "Final Attendance Rows": finalAttendanceCount,
    "Rows Added in Sheets": rowsAdded,
  });

  if (Object.keys(errors).length > 0) {
    console.log('\n=== ERRORS ENCOUNTERED ===');
    console.table(errors);
  }

  console.log('\n=== FINAL VERDICT ===');
  console.log(`Zero quota errors: ${hasQuotaErrors ? 'FAIL' : 'PASS'}`);
  const expectedRowsAdded = successCount - duplicateCount;
  const noDuplicateRows = rowsAdded === expectedRowsAdded;
  console.log(`No duplicate attendance rows: ${noDuplicateRows ? 'PASS' : `FAIL (Expected ${expectedRowsAdded}, Got ${rowsAdded})`}`);
  console.log(`Average response time under 2s: ${isTimePass ? 'PASS' : 'FAIL'}`);
  console.log(`Dashboard Requests Succeed: ${dashboardErrors === 0 ? 'PASS' : 'FAIL'}`);
}

runTest();
