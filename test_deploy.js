async function test() {
  const eRes = await fetch('http://localhost:3002/api/emergency', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bus_number: 'Bus 1', driver_name: 'Test Driver' })
  });
  console.log('Emergency POST status:', eRes.status, await eRes.text());
}
test().catch(console.error);
