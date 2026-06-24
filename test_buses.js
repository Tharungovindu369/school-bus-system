const http = require('http');
http.get('http://localhost:3002/api/buses', res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log(JSON.parse(data).map(b => b.bus_number));
  });
});
