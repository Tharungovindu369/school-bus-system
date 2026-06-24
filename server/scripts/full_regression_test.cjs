const http = require('http');

const API_URL = 'http://localhost:3002/api';
const ADMIN_PASSWORD = 'admin123';
const DRIVER_PIN = '0001';
const RECEPTION_PIN = '9999';

const results = [];
let testStudentId = '';

async function request(path, options = {}) {
  const url = new URL(`${API_URL}${path}`);
  const opts = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  };
  if (options.body) opts.body = JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTest(name, testFn) {
  try {
    await testFn();
    results.push({ name, status: 'PASS', error: '' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message });
    console.log(`[FAIL] ${name} - ${err.message}`);
  }
}

async function main() {
  console.log('--- STARTING FULL REGRESSION SUITE ---');

  // 1. Auth Tests
  await runTest('Admin Login Valid', async () => {
    const res = await request('/admin/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
    assert(res.status === 200 && res.data.success, 'Login failed');
  });

  await runTest('Admin Login Invalid', async () => {
    const res = await request('/admin/login', { method: 'POST', body: { password: 'wrong' } });
    assert(res.status === 401, 'Invalid login should return 401');
  });

  await runTest('Driver Login Valid', async () => {
    const res = await request('/driver/login', { method: 'POST', body: { pin: DRIVER_PIN, busNumber: '1' } });
    assert(res.status === 200 && res.data.success, 'Driver login failed');
  });

  await runTest('Reception Login Valid', async () => {
    const res = await request('/reception/login', { method: 'POST', body: { pin: RECEPTION_PIN } });
    assert(res.status === 200 && res.data.success, 'Reception login failed');
  });

  // Fetch students to use for testing
  let studentData = null;
  let studentData2 = null;
  await runTest('Fetch Students', async () => {
    const res = await request('/students', { headers: { 'x-admin-password': ADMIN_PASSWORD } });
    assert(res.status === 200 && Array.isArray(res.data) && res.data.length > 1, 'Could not fetch students');
    studentData = res.data[0];
    testStudentId = studentData.student_id;
    studentData2 = res.data[1];
  });

  // 2. Driver Workflows
  await runTest('Driver Start Morning Bus', async () => {
    const res = await request('/bus/start', { method: 'POST', body: { pin: DRIVER_PIN, bus_number: studentData.bus_number, driver_name: 'Test Driver' } });
    assert(res.status === 200 && res.data.success, 'Failed to start morning bus');
  });

  await runTest('Driver Scan Student', async () => {
    const res = await request('/scan', { method: 'POST', body: { student_id: testStudentId, bus_number: studentData.bus_number, scan_type: 'boarding', source: 'driver' } });
    assert(res.status === 200 && res.data.success, 'Failed to scan student');
  });

  await runTest('Driver Scan Duplicate', async () => {
    const res = await request('/scan', { method: 'POST', body: { student_id: testStudentId, bus_number: studentData.bus_number, scan_type: 'boarding', source: 'driver' } });
    assert(res.status === 200 && res.data.duplicate === true, 'Duplicate scan did not fail correctly');
  });

  await runTest('Driver Scan Cross-Bus', async () => {
    const res = await request('/scan', { method: 'POST', body: { student_id: studentData2.student_id, bus_number: 'Bus 99', scan_type: 'boarding', source: 'driver' } });
    assert(res.status === 200 && res.data.isCrossBus, 'Cross-bus scan failed or flag not set');
  });

  await runTest('Driver Stop Morning Bus', async () => {
    const res = await request('/bus/stop', { method: 'POST', body: { pin: DRIVER_PIN, bus_number: studentData.bus_number } });
    assert(res.status === 200 && res.data.success, 'Failed to stop morning bus');
  });

  await runTest('Driver Start Return Bus', async () => {
    const res = await request('/bus/start-return', { method: 'POST', body: { pin: DRIVER_PIN, bus_number: studentData.bus_number, driver_name: 'Test Driver' } });
    assert(res.status === 200 && res.data.success, 'Failed to start return bus');
  });

  await runTest('Driver Stop Return Bus', async () => {
    const res = await request('/bus/stop-return', { method: 'POST', body: { pin: DRIVER_PIN, bus_number: studentData.bus_number } });
    assert(res.status === 200 && res.data.success, 'Failed to stop return bus');
  });

  await runTest('Driver Emergency Alert', async () => {
    const res = await request('/emergency', { method: 'POST', body: { bus_number: studentData.bus_number, incident_type: 'Breakdown', details: 'Test emergency' } });
    if (res.status !== 200 && res.status !== 404) throw new Error('Emergency endpoint failed unexpectedly');
  });

  // 3. Reception Workflows
  await runTest('Reception Scan Missed Student', async () => {
    const res = await request('/reception/scan', { method: 'POST', headers: { 'x-reception-pin': RECEPTION_PIN }, body: { student_id: 'S9999' } });
    assert(res.status === 200 || res.status === 404, 'Reception scan failed');
  });

  await runTest('Reception Summary', async () => {
    const res = await request('/reception/summary', { headers: { 'x-reception-pin': RECEPTION_PIN } });
    assert(res.status === 200 && res.data.missedScans !== undefined, 'Reception summary failed');
  });

  // 4. Admin Workflows
  await runTest('Admin Dashboard Stats', async () => {
    const res = await request('/admin/dashboard', { headers: { 'x-admin-password': ADMIN_PASSWORD } });
    assert(res.status === 200 && res.data.totalStudents !== undefined, 'Dashboard stats failed');
  });

  await runTest('Admin Fee Update (Custom Date)', async () => {
    const res = await request(`/fee/${testStudentId}`, { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { custom_date: '2026-12-31' } });
    assert(res.status === 200 && res.data.fee_due_date === '2026-12-31', 'Custom fee update failed');
  });

  await runTest('Admin Fee Update (Mark Due)', async () => {
    const res = await request(`/fee/${testStudentId}`, { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { mark_due: true } });
    assert(res.status === 200 && res.data.fee_status === 'DUE', 'Mark due failed');
  });

  await runTest('Admin Fee Update (1 Month)', async () => {
    const res = await request(`/fee/${testStudentId}`, { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { duration_months: 1 } });
    assert(res.status === 200 && res.data.fee_status === 'PAID', '1 month duration update failed');
  });

  await runTest('Admin Change Bus', async () => {
    const res = await request(`/students/${testStudentId}/bus`, { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { bus_number: 'Bus 50' } });
    assert(res.status === 200 && res.data.bus_number === 'Bus 50', 'Change bus failed');
    await request(`/students/${testStudentId}/bus`, { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { bus_number: studentData.bus_number } });
  });

  await runTest('Admin Edit Driver', async () => {
    const res = await request(`/bus/${encodeURIComponent(studentData.bus_number)}/driver`, { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { driver_name: 'New Driver', driver_phone: '12345' } });
    assert(res.status === 200 && res.data.success, 'Edit driver failed');
  });

  await runTest('Admin Bulk Fee Update', async () => {
    const res = await request('/students/bulk-fee', { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { student_ids: [testStudentId], fee_paid_until: '2026-08-01' } });
    assert(res.status === 200 && res.data.success, 'Bulk fee update failed');
  });

  await runTest('Admin Bulk Bus Update', async () => {
    const res = await request('/students/bulk-bus', { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { student_ids: [testStudentId], bus_number: 'Bus 20' } });
    assert(res.status === 200 && res.data.success, 'Bulk bus update failed');
    await request('/students/bulk-bus', { method: 'PUT', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: { student_ids: [testStudentId], bus_number: studentData.bus_number } });
  });

  await runTest('Admin Bus Reassignment', async () => {
    const payload = {
      bus_number: studentData.bus_number,
      temp_driver: 'Temp',
      temp_driver_phone: '123',
      temp_driver_bus: 'Bus 21',
      reason: 'Testing',
      reassigned_by: 'Admin',
      end_date: '2026-12-31'
    };
    const res = await request('/reassignments', { method: 'POST', headers: { 'x-admin-password': ADMIN_PASSWORD }, body: payload });
    assert(res.status === 200 && res.data.success, 'Bus reassignment failed');
  });

  await runTest('Admin Incidents List', async () => {
    const res = await request('/incidents', { headers: { 'x-admin-password': ADMIN_PASSWORD } });
    assert(res.status === 200 && Array.isArray(res.data), 'Incidents list failed');
  });

  await runTest('Admin Student Lookup', async () => {
    const res = await request(`/admin/student/${testStudentId}`, { headers: { 'x-admin-password': ADMIN_PASSWORD } });
    assert(res.status === 200 && res.data.student && res.data.history, 'Student lookup failed');
  });

  await runTest('Admin Manage Credentials Read', async () => {
    const res = await request('/admin/credentials', { headers: { 'x-admin-password': ADMIN_PASSWORD } });
    assert(res.status === 200 && res.data.adminPassword, 'Manage credentials read failed');
  });

  await runTest('Admin CSV Export Attendance', async () => {
    const res = await request('/admin/export/attendance', { headers: { 'x-admin-password': ADMIN_PASSWORD } });
    assert(res.status === 200 || res.status === 404, 'CSV export attendance failed');
  });

  // 5. Parent Lookup
  await runTest('Parent Lookup Status Response', async () => {
    const last4 = String(studentData.parent_whatsapp || '').trim().slice(-4);
    const res = await request('/lookup', { method: 'POST', body: { student_id: testStudentId, last4 } });
    assert(res.status === 200 && res.data.student, 'Parent lookup failed');
  });

  // Summary
  console.log('\n=== REGRESSION TEST SUMMARY ===');
  console.table(results);
  
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} TESTS FAILED.`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED.');
  }
}

main().catch(console.error);
