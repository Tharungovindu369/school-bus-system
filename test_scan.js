async function testScan() {
  const result = await fetch('http://localhost:3002/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: 'S0040',
      bus_number: '1',
      driver_name: 'Test Driver'
    })
  }).then(r => r.json());
  console.log(result);
}
testScan();


