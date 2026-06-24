import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');
const QUEUE_FILE = path.join(ROOT_DIR, 'data/queue_backup.json');

const API_URL = 'http://localhost:3002/api';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let serverProcess = null;

function startServer() {
  return new Promise((resolve) => {
    console.log('Starting server...');
    serverProcess = spawn('node', ['index.js'], { cwd: ROOT_DIR });
    
    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('listening on port 3002')) {
        resolve();
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });
  });
}

function killServer() {
  if (serverProcess) {
    console.log('Force killing server...');
    serverProcess.kill('SIGKILL');
    serverProcess = null;
  }
}

async function runTest() {
  try {
    // 0. Ensure clean state
    if (fs.existsSync(QUEUE_FILE)) {
      fs.unlinkSync(QUEUE_FILE);
    }
    
    // 1. Start Server
    await startServer();
    await delay(1000); // Give it a sec to initialize Sheets

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    // Fetch initial attendance count
    const resInitial = await fetch(`${API_URL}/attendance?date=${today}`);
    const initialData = await resInitial.json();
    const initialCount = initialData.length;
    console.log(`Initial attendance rows for test date: ${initialCount}`);

    // 2. Fire some requests
    console.log('Firing 3 mock scans...');
    const scans = [
      { student_id: 'S2210', bus_number: 'B01' },
      { student_id: 'S2211', bus_number: 'B01' },
      { student_id: 'S2212', bus_number: 'B01' }
    ];
    
    for (const scan of scans) {
      const res = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scan)
      });
      const data = await res.json();
      console.log('Scan response:', res.status, data);
    }

    // Give fs.writeFile a fraction of a second to complete async write before pulling the plug
    await delay(500);

    // 3. Immediately kill server BEFORE flush interval (5s)
    killServer();

    // 4. Verify queue_backup.json exists and has 3 items
    if (!fs.existsSync(QUEUE_FILE)) {
      throw new Error('QUEUE_FILE was not created!');
    }
    const queueData = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    if (queueData.attendanceQueue.length !== 3) {
      throw new Error(`QUEUE_FILE should have 3 items, found ${queueData.attendanceQueue.length}`);
    }
    console.log('✔ Verified: queue.json exists and contains 3 unflushed items.');

    // 5. Restart Server
    await startServer();
    
    // 6. Wait for interval to flush (e.g. 7 seconds)
    console.log('Waiting 7 seconds for WriteQueue to flush on restart...');
    await delay(7000);

    // 7. Verify items are now in Google Sheets (and not duplicated)
    const resFinal = await fetch(`${API_URL}/attendance?date=${today}`);
    const finalData = await resFinal.json();
    const finalCount = finalData.length;
    
    console.log(`Final attendance rows for test date: ${finalCount}`);
    if (finalCount !== initialCount + 3) {
      throw new Error(`Expected ${initialCount + 3} rows, got ${finalCount}. Data loss or duplicates occurred!`);
    }
    console.log('✔ Verified: Records were successfully flushed to Google Sheets upon recovery.');
    
    // Cleanup: Delete queue file just in case
    if (fs.existsSync(QUEUE_FILE)) {
      fs.unlinkSync(QUEUE_FILE);
    }
    killServer();
    
    console.log('\n=== CRASH RECOVERY TEST: PASS ===\n');
    process.exit(0);

  } catch (err) {
    killServer();
    console.error('\n=== CRASH RECOVERY TEST: FAIL ===');
    console.error(err.message);
    process.exit(1);
  }
}

runTest();
