const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3002/api';
let results = [];
let passCount = 0;
let failCount = 0;

async function request(method, endpoint, headers = {}, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) options.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${API}${endpoint}`, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: err.message };
  }
}

function logTest(category, description, expected, actual, passed) {
  if (passed) passCount++; else failCount++;
  results.push({ category, description, expected, actual, passed });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${description}\n  Expected: ${expected}\n  Actual: ${actual}\n`);
}

async function runTests() {
  console.log("Starting Exhaustive Verification...\n");

  // --- 1. NEW ROLE SECURITY ---
  const cat1 = "1. NEW ROLE SECURITY";
  const accHeader = { 'x-accountant-pin': '1234' };
  const busHeader = { 'x-bus-incharge-pin': '5678' };
  const admHeader = { 'x-admin-password': '123' }; // wait, what is admin password? Let's check config or try admin123
  
  // Test Accountant
  let res = await request('GET', '/incidents', accHeader);
  logTest(cat1, "Accountant: GET /incidents", "403 Forbidden", `${res.status} ${JSON.stringify(res.data)}`, res.status === 403);
  
  res = await request('PUT', '/students/STU999/bus', accHeader, { bus_number: 'Bus 2' });
  logTest(cat1, "Accountant: PUT /students/:id/bus", "403 Forbidden", `${res.status} ${JSON.stringify(res.data)}`, res.status === 403);
  
  res = await request('GET', '/reassignments/active', accHeader);
  logTest(cat1, "Accountant: GET /reassignments/active", "403 Forbidden", `${res.status} ${JSON.stringify(res.data)}`, res.status === 403);

  // Test Bus Incharge
  res = await request('PUT', '/fee/STU999', busHeader, { duration_months: 1 });
  logTest(cat1, "Bus Incharge: PUT /fee/:id", "403 Forbidden", `${res.status} ${JSON.stringify(res.data)}`, res.status === 403);
  
  res = await request('GET', '/admin/student/STU999', busHeader);
  logTest(cat1, "Bus Incharge: GET /admin/student/:id", "403 Forbidden", `${res.status} ${JSON.stringify(res.data)}`, res.status === 403);

  // --- 2. GATE SCANNER ---
  const cat2 = "2. GATE SCANNER (Yellow/Green/Red)";
  // Let's create a test student directly in sheet or just test the logic with existing students if we know their state.
  // Actually we can add a test student first.

  // --- 3. NEW STUDENT + QR FLOW ---
  const cat3 = "3. NEW STUDENT + QR FLOW";
  res = await request('POST', '/students', { 'x-admin-password': 'admin123' }, {
    student_id: 'TEST_QA_401',
    name: 'QA Test Student',
    class: '10A',
    bus_number: 'Bus 1',
    stop_name: 'QA Stop',
    parent_whatsapp: '1234567890'
  });
  logTest(cat3, "Add New Student", "200 OK + success:true", `${res.status} ${JSON.stringify(res.data)}`, res.status === 200 && res.data.success);

  res = await request('POST', '/students', { 'x-admin-password': 'admin123' }, {
    student_id: 'TEST_QA_401',
    name: 'Duplicate',
    bus_number: 'Bus 1',
    stop_name: 'QA Stop'
  });
  logTest(cat3, "Duplicate Student Rejection", "400 Bad Request", `${res.status} ${JSON.stringify(res.data)}`, res.status === 400 && res.data.error.includes('exists'));

  res = await request('GET', '/qr/generate/TEST_QA_401', { 'x-admin-password': 'admin123' });
  const html = res.data;
  const qrLayoutCorrect = html.includes('TEST_QA_401') && html.includes('QA Test Student') && html.includes('1234567890') && !html.includes('Class 10A') && !html.includes('Bus 1');
  logTest(cat3, "QR Layout Minimal", "Contains ID, Name, Phone. NO Class, NO Bus.", `Matches criteria: ${qrLayoutCorrect}`, qrLayoutCorrect);

  // NOW TEST GATE SCANNER USING THIS STUDENT
  // Case 3: Not Scanned + Due (since no fee date provided)
  res = await request('POST', '/reception/scan', {}, { student_id: 'TEST_QA_401' });
  logTest(cat2, "Not Scanned + Due", "isDue: true, driverScanned: false", `isDue: ${res.data.isDue}, driverScanned: ${res.data.driverScanned}`, res.data.isDue === true && res.data.driverScanned === false);

  // Pay the fee (Admin) to test Case 4
  await request('PUT', '/fee/TEST_QA_401', { 'x-admin-password': 'admin123' }, { duration_months: 12 });
  
  // Wait, gate scanner caches attendance for duplicates. We need to clear it or use different students.
  // Actually, we can just use 4 different test students to be safe from duplicate blocking.
  await request('POST', '/students', { 'x-admin-password': 'admin123' }, { student_id: 'TEST_QA_402', name: 'T2', bus_number: 'Bus 1', stop_name: 'QA', fee_paid_until: '2027-01-01' });
  await request('POST', '/students', { 'x-admin-password': 'admin123' }, { student_id: 'TEST_QA_403', name: 'T3', bus_number: 'Bus 1', stop_name: 'QA' });
  await request('POST', '/students', { 'x-admin-password': 'admin123' }, { student_id: 'TEST_QA_404', name: 'T4', bus_number: 'Bus 1', stop_name: 'QA', fee_paid_until: '2027-01-01' });

  // Case 4: Not Scanned + Paid (TEST_QA_402)
  res = await request('POST', '/reception/scan', {}, { student_id: 'TEST_QA_402' });
  logTest(cat2, "Not Scanned + Paid", "isDue: false, driverScanned: false", `isDue: ${res.data.isDue}, driverScanned: ${res.data.driverScanned}`, res.data.isDue === false && res.data.driverScanned === false);

  // Driver Scan for T3 and T4
  await request('POST', '/scan', { 'x-driver-pin': '0001' }, { student_id: 'TEST_QA_403', bus_number: '1', scan_mode: 'morning' });
  await request('POST', '/scan', { 'x-driver-pin': '0001' }, { student_id: 'TEST_QA_404', bus_number: '1', scan_mode: 'morning' });

  // Case 2: Driver Scanned + Due (TEST_QA_403)
  res = await request('POST', '/reception/scan', {}, { student_id: 'TEST_QA_403' });
  logTest(cat2, "Driver Scanned + Due", "isDue: true, driverScanned: true", `isDue: ${res.data.isDue}, driverScanned: ${res.data.driverScanned}`, res.data.isDue === true && res.data.driverScanned === true);

  // Case 1: Driver Scanned + Paid (TEST_QA_404)
  res = await request('POST', '/reception/scan', {}, { student_id: 'TEST_QA_404' });
  logTest(cat2, "Driver Scanned + Paid", "isDue: false, driverScanned: true", `isDue: ${res.data.isDue}, driverScanned: ${res.data.driverScanned}`, res.data.isDue === false && res.data.driverScanned === true);


  // --- 4. FULL EXISTING FEATURE REGRESSION ---
  const cat4 = "4. REGRESSION";
  
  // Rate limiting
  let rateLimitHit = false;
  let attempt = 0;
  for(let i=0; i<10; i++) {
    const rl = await request('POST', '/admin/login', {}, { password: 'bad' });
    if (rl.status === 429) { rateLimitHit = true; attempt = i + 1; break; }
  }
  logTest(cat4, "Rate Limiting on Login", "429 Too Many Requests (approx 6th attempt)", `Hit at attempt ${attempt}`, rateLimitHit && attempt >= 5 && attempt <= 7);

  // Generate Report
  const md = [
    '# Exhaustive Verification Report\n',
    `**Total Passed:** ${passCount}`,
    `**Total Failed:** ${failCount}\n`,
    '| Category | Description | Expected | Actual | Status |',
    '|---|---|---|---|---|',
    ...results.map(r => `| ${r.category} | ${r.description} | ${r.expected} | ${r.actual.replace(/\\n/g, ' ')} | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`)
  ].join('\n');

  fs.writeFileSync('verification_report.md', md);
  console.log('Report saved to verification_report.md');
}

runTests();
