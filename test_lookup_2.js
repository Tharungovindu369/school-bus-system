const http = require('http');
http.get('http://localhost:3002/api/admin/student/S0002?password=admin123', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(data));
});
