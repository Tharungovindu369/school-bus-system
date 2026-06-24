

async function runTests() {
  const BASE_URL = 'http://localhost:3002';
  const ADMIN_PASS = 'admin123';
  let passed = 0, failed = 0;

  function report(name, success, info = '') {
    if (success) {
      console.log(`[PASS] ${name} ${info}`);
      passed++;
    } else {
      console.log(`[FAIL] ${name} ${info}`);
      failed++;
    }
  }

  try {
    // 1. Admin login correct
    let res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASS })
    });
    let data = await res.json();
    report('Admin Login Correct', data.success, JSON.stringify(data));

    // 2. Admin rate limit
    let rlPassed = false;
    for (let i = 0; i < 6; i++) {
      res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' })
      });
      if (i === 5) rlPassed = res.status === 429;
    }
    report('Admin Rate Limiting', rlPassed);

    // 3. Admin Overview Widgets
    res = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { 'x-admin-password': ADMIN_PASS }
    });
    data = await res.json();
    report('Admin Overview Widgets', !!data.totalStudents && data.incidents !== undefined);

    // 4. Driver Login Correct
    res = await fetch(`${BASE_URL}/api/driver/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busNumber: '1', pin: '1234' })
    });
    data = await res.json();
    report('Driver Login Correct', data.success, JSON.stringify(data));

    // 5. Driver rate limit
    rlPassed = false;
    for (let i = 0; i < 6; i++) {
      res = await fetch(`${BASE_URL}/api/driver/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busNumber: '1', pin: 'wrong' })
      });
      if (i === 5) rlPassed = res.status === 429;
    }
    report('Driver Rate Limiting', rlPassed);

    // 6. Reception Login Correct
    res = await fetch(`${BASE_URL}/api/reception/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '5678' })
    });
    data = await res.json();
    report('Reception Login Correct', data.success, JSON.stringify(data));

    // 7. Reception rate limit
    rlPassed = false;
    for (let i = 0; i < 6; i++) {
      res = await fetch(`${BASE_URL}/api/reception/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: 'wrong' })
      });
      if (i === 5) rlPassed = res.status === 429;
    }
    report('Reception Rate Limiting', rlPassed);

    // 8. Parent Lookup Rate Limit
    rlPassed = false;
    for (let i = 0; i < 6; i++) {
      res = await fetch(`${BASE_URL}/api/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: 'wrong', last4: 'wrong' })
      });
      if (i === 5) rlPassed = res.status === 429;
    }
    report('Parent Lookup Rate Limit', rlPassed);

    // 9. Check Credentials Hash
    const { getSheetData } = require('./server/services/sheets.js');
    const creds = await getSheetData('Credentials!A:C');
    const hasPlaintext = creds.slice(1).some(r => r[2] && r[2].length < 20); // bcrypt hashes are long
    report('Credentials Hashed', !hasPlaintext);

  } catch (err) {
    console.error('Test Error:', err);
  }

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
}

runTests();
