async function testAuth() {
  const driverCorrect = await fetch('http://localhost:3002/api/driver/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ busNumber: 'Bus 1', pin: '9999' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const driverIncorrect = await fetch('http://localhost:3002/api/driver/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ busNumber: 'Bus 1', pin: '0001' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  console.log('Driver 1 Correct (9999):', driverCorrect);
  console.log('Driver 1 Incorrect (0001):', driverIncorrect);
}
testAuth();
