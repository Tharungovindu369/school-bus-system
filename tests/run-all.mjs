import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3002';
const receptionPin = process.env.RECEPTION_PIN || '9999';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

let driverPins = { 'Bus 1': '0001' };
if (process.env.DRIVER_PINS) {
  try {
    driverPins = JSON.parse(process.env.DRIVER_PINS);
  } catch {
    console.warn('WARNING: DRIVER_PINS is not valid JSON, using default values.');
  }
}

const sampleBusNumber = process.env.TEST_BUS_NUMBER || Object.keys(driverPins)[0] || 'Bus 1';
const sampleDriverPin = driverPins[sampleBusNumber] || Object.values(driverPins)[0] || '0001';

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

async function runTest(name, fn) {
  process.stdout.write(`${name}... `);
  try {
    await fn();
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  await runTest('Health check', async () => {
    const res = await fetchJson(`${BASE_URL}/api/health`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data?.school) throw new Error('Missing school field in health response');
  });

  await runTest('Driver pins endpoint', async () => {
    const res = await fetchJson(`${BASE_URL}/api/driver/pins`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.data?.buses)) throw new Error('Expected buses array');
  });

  await runTest('Reception login', async () => {
    const res = await fetchJson(`${BASE_URL}/api/reception/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: receptionPin })
    });
    if (res.status !== 200 || res.data?.success !== true) {
      throw new Error(`Reception login failed: ${JSON.stringify(res)}`);
    }
  });

  await runTest('Driver login', async () => {
    const res = await fetchJson(`${BASE_URL}/api/driver/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busNumber: sampleBusNumber, pin: sampleDriverPin })
    });
    if (res.status !== 200 || res.data?.success !== true) {
      throw new Error(`Driver login failed: ${JSON.stringify(res)}`);
    }
  });

  await runTest('List buses', async () => {
    const res = await fetchJson(`${BASE_URL}/api/buses`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('Expected array response');
  });

  await runTest('List attendance', async () => {
    const res = await fetchJson(`${BASE_URL}/api/attendance`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('Expected attendance array');
  });

  console.log('\nSummary: verification completed.');
}

main();
