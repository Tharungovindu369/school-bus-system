const fs = require('fs');
let code = fs.readFileSync('server/index.js.recovered', 'utf16le');
if (code.charCodeAt(0) === 0xFEFF || code.charCodeAt(0) === 0xFFFE) { code = code.slice(1); }
code = code.replace(/^[^a-zA-Z]*/, '');

const start = code.indexOf("app.post('/api/lookup'");
if (start !== -1) {
  const nextAppPost = code.indexOf("app.get('/api/attendance'", start);
  console.log(code.substring(start, nextAppPost > -1 ? nextAppPost : start + 2000));
} else {
  console.log('NOT FOUND');
}
