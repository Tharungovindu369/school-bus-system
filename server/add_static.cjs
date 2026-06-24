const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const staticCode = `
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
`;

if (!code.includes('express.static')) {
  code = code.replace('app.listen(config.port', staticCode + '\napp.listen(config.port');
  fs.writeFileSync('server/index.js', code);
  console.log('Added static file serving');
}
