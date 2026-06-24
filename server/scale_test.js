import { getSheets } from './services/sheets.js';
import { config } from './config.js';
import http from 'http';

// Helper to make API requests
function request(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let result = '';
      res.on('data', d => result += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(result) }); }
        catch { resolve({ status: res.statusCode, body: result }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function runScaleTest() {
  try {
    const sheets = await getSheets();
    const spId = config.googleSheetsId;

    console.log('--- SCALE TEST STARTING ---');
    
    // 1. Fetch current students
    console.log('Fetching current student list & spreadsheet details...');
    const meta = await sheets.spreadsheets.get({ spreadsheetId: spId });
    const studentsSheet = meta.data.sheets.find(s => s.properties.title === 'Students');
    if (!studentsSheet) throw new Error('Students sheet not found in spreadsheet.');
    const sheetId = studentsSheet.properties.sheetId;

    const originalStudentsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: spId,
      range: 'Students!A:K'
    });
    const originalRows = originalStudentsRes.data.values || [];
    const originalCount = originalRows.length - 1; // subtract header
    console.log(`Original student sheet has ${originalRows.length} rows (including header). Real students = ${originalCount}`);

    if (originalCount !== 2265) {
      console.warn(`Warning: Expected 2265 real students, found ${originalCount}`);
    }

    // 2. Add rows to Students sheet to prevent grid limits error
    const targetTotal = 3500;
    const toAddCount = targetTotal - originalCount;
    console.log(`Adding ${toAddCount} row capacity to sheet (sheetId=${sheetId})...`);
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: sheetId,
              dimension: 'ROWS',
              length: toAddCount
            }
          }
        ]
      }
    });
    console.log('Successfully expanded sheet row capacity.');

    // 3. Generate and write synthetic students
    const syntheticStudents = [];
    const startIdx = originalCount + 1;
    for (let i = 0; i < toAddCount; i++) {
      const idNum = startIdx + i;
      const studentId = `TEST_S${String(idNum).padStart(4, '0')}`;
      const busNum = String((idNum % 14) + 1); // distribute across 14 buses
      const feeStatus = i % 5 === 0 ? 'DUE' : 'PAID';
      
      syntheticStudents.push([
        studentId,
        `Synthetic Student ${idNum}`,
        `Class ${idNum % 4 + 1}`,
        `Bus ${busNum}`,
        `Stop ${idNum % 10 + 1}`,
        `Parent ${idNum}`,
        `91999999${String(idNum).padStart(4, '0')}`,
        feeStatus,
        feeStatus === 'DUE' ? '2026-06-01' : '',
        feeStatus === 'PAID' ? '2026-08-01' : '',
        '0000'
      ]);
    }

    const startRow = originalRows.length + 1;
    const endRow = originalRows.length + toAddCount;
    const writeRange = `Students!A${startRow}:K${endRow}`;
    
    console.log(`Writing synthetic students to range ${writeRange}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: spId,
      range: writeRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: syntheticStudents }
    });
    console.log('Successfully written synthetic students.');

    // Force server cache invalidation via a dummy fee update
    console.log('Invalidating server cache via dummy fee update...');
    await request('PUT', '/fee/S0001', { mark_due: true }, { 'x-accountant-pin': '1234' });
    console.log('Fetching students to verify cache update...');
    const countCheck = await request('GET', '/students', null, { 'x-admin-password': 'admin123' });
    console.log(`Server API returns student count: ${countCheck.body?.length}`);

    // 4. Execute concurrent burst scan test (mixed requests)
    const concurrentRequests = 300;
    console.log(`Running concurrent scan simulation with ${concurrentRequests} requests...`);

    const times = [];
    let successCount = 0;
    let failureCount = 0;
    let quotaErrors = 0;
    const startAll = Date.now();

    const promises = Array.from({ length: concurrentRequests }, (_, idx) => {
      const isSynthetic = idx % 2 === 0;
      const idNum = startIdx + (idx % toAddCount);
      const studentId = isSynthetic ? `TEST_S${String(idNum).padStart(4, '0')}` : `S0002`;
      
      const reqStart = Date.now();
      
      let path = '/scan';
      let method = 'POST';
      let payload = { student_id: studentId, bus_number: '2', stop_name: 'Test Stop', driver_name: 'Test Driver' };
      
      if (idx % 3 === 1) {
        path = '/reception/scan';
        payload = { student_id: studentId };
      } else if (idx % 3 === 2) {
        path = '/lookup';
        payload = { student_id: studentId, last4: '0000' };
      }

      return request(method, path, payload)
        .then(res => {
          const dur = Date.now() - reqStart;
          times.push(dur);
          if (res.status === 200) {
            successCount++;
          } else {
            failureCount++;
            if (res.status === 429 || JSON.stringify(res.body).toLowerCase().includes('quota')) {
              quotaErrors++;
            }
          }
        });
    });

    await Promise.all(promises);
    const totalDuration = Date.now() - startAll;

    times.sort((a, b) => a - b);
    const fastest = times[0] || 0;
    const median = times[Math.floor(times.length * 0.5)] || 0;
    const p95 = times[Math.floor(times.length * 0.95)] || 0;
    const slowest = times[times.length - 1] || 0;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    console.log('\n=== SCALE TEST RESULTS (3500 Students) ===');
    console.log(`Total Requests: ${concurrentRequests}`);
    console.log(`Success Count: ${successCount}`);
    console.log(`Failure/Error Count: ${failureCount}`);
    console.log(`Quota/Rate Limit Errors: ${quotaErrors}`);
    console.log(`Response Time Distribution:`);
    console.log(`  Fastest: ${fastest} ms`);
    console.log(`  Median:  ${median} ms`);
    console.log(`  Average: ${avg.toFixed(1)} ms`);
    console.log(`  p95:     ${p95} ms`);
    console.log(`  Slowest: ${slowest} ms`);
    console.log(`Total Duration: ${totalDuration} ms`);

    // 5. CLEANUP: delete newly added rows to restore sheet precisely to 2266 rows
    console.log(`\nCleaning up range and deleting synthetic rows (startIndex=${startRow - 1}, endIndex=${endRow})...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: startRow - 1,
                endIndex: endRow
              }
            }
          }
        ]
      }
    });
    console.log('Successfully deleted synthetic rows.');

    // Force server cache invalidation again via a dummy fee update
    await request('PUT', '/fee/S0001', { mark_due: false }, { 'x-accountant-pin': '1234' });
    
    // Check original count again
    const finalCheck = await request('GET', '/students', null, { 'x-admin-password': 'admin123' });
    const finalRealCount = finalCheck.body?.length;
    console.log(`Final student count check from API: ${finalRealCount}`);
    
    if (finalRealCount === originalCount) {
      console.log('SUCCESS: Students database successfully reverted to original state.');
    } else {
      console.error(`ERROR: Final count mismatch! Expected ${originalCount}, got ${finalRealCount}`);
    }

  } catch (err) {
    console.error('Scale test script encountered a fatal error:', err);
  }
}

runScaleTest();
