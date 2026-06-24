const http = require('http');

const data = JSON.stringify({
  bus_number: '1',
  driver_name: 'Test Driver'
});

const req = http.request({
  hostname: 'localhost',
  port: 3002,
  path: '/api/bus/stop-return',
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
