async function testAuth() {
  const adminCorrect = await fetch('http://localhost:3002/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const adminIncorrect = await fetch('http://localhost:3002/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const receptionCorrect = await fetch('http://localhost:3002/api/reception/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '9999' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const receptionIncorrect = await fetch('http://localhost:3002/api/reception/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '0000' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const driverCorrect = await fetch('http://localhost:3002/api/driver/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ busNumber: 'Bus 1', pin: '0001' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const driverIncorrect = await fetch('http://localhost:3002/api/driver/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ busNumber: 'Bus 1', pin: '9999' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  const driver2Correct = await fetch('http://localhost:3002/api/driver/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ busNumber: 'Bus 2', pin: '0002' })
  }).then(async r => { const t=await r.text(); try{return JSON.parse(t)}catch{return {status:r.status, text:t}}});

  console.log('Admin Correct:', adminCorrect);
  console.log('Admin Incorrect:', adminIncorrect);
  console.log('Reception Correct:', receptionCorrect);
  console.log('Reception Incorrect:', receptionIncorrect);
  console.log('Driver 1 Correct:', driverCorrect);
  console.log('Driver 1 Incorrect:', driverIncorrect);
  console.log('Driver 2 Correct:', driver2Correct);
}
testAuth();

