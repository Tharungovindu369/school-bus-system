const http = require('http');

async function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        ...headers
      }
    }, (res) => {
      let result = '';
      res.on('data', d => result += d);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(result) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path,
      method: 'GET',
      headers
    }, (res) => {
      let result = '';
      res.on('data', d => result += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(result) }); }
        catch (e) { resolve({ status: res.statusCode, data: result }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('Testing Driver Login...');
  const drv = await post('/api/driver/login', { pin: '1234', busNumber: '1' });
  console.log('Driver:', drv.status, drv.data.success ? 'PASS' : 'FAIL');

  console.log('Testing Reception Login...');
  const rec = await post('/api/reception/login', { pin: '4444' });
  console.log('Reception:', rec.status, rec.data.success ? 'PASS' : 'FAIL');

  console.log('Testing Admin Login...');
  const adm = await post('/api/admin/login', { password: 'adminpassword' });
  console.log('Admin:', adm.status, adm.data.success ? 'PASS' : 'FAIL');

  console.log('Testing Scan...');
  const scan = await post('/api/scan', { student_id: 'S0001', bus_number: '1' });
  console.log('Scan:', scan.status, scan.data.success ? 'PASS' : 'FAIL');
  
  console.log('Testing Reception Scan...');
  const rscan = await post('/api/reception/scan', { student_id: 'S0002' });
  console.log('Rec Scan:', rscan.status, rscan.data.success ? 'PASS' : 'FAIL');
  
  console.log('Testing Admin Dashboard...');
  const dash = await get('/api/admin/dashboard', { 'x-admin-password': 'adminpassword' });
  console.log('Dash:', dash.status, dash.data.totalStudents ? 'PASS' : 'FAIL');
  
  console.log('Testing Lookup...');
  const lkp = await post('/api/lookup', { student_id: 'S0001', last4: '1234' });
  console.log('Lookup:', lkp.status, lkp.data.success ? 'PASS' : 'FAIL');
}
run();
