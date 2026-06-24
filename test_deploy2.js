async function test() {
  let res = await fetch('http://localhost:3002/api/bus/Bus%201/driver', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-password': 'adminPassword' },
    body: JSON.stringify({ driver_name: 'Test Name', driver_phone: '1234567890' })
  });
  console.log('Wrong password PUT status:', res.status);

  res = await fetch('http://localhost:3002/api/bus/Bus%201/driver', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-password': 'admin1234' },
    body: JSON.stringify({ driver_name: 'Test Name', driver_phone: '1234567890' })
  });
  console.log('Right password PUT status:', res.status, await res.json());
}
test().catch(console.error);
