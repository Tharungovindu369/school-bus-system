const http = require('http');

const data = JSON.stringify({
  student_id: 'S1500',
  last4: '1234'
});

const req = http.request({
  hostname: 'localhost',
  port: 3002,
  path: '/api/lookup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(res.statusCode, body));
});

req.write(data);
req.end();
