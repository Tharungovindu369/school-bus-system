const fs = require('fs');

let recovered = fs.readFileSync('server/index.js.recovered', 'utf16le');
if (recovered.charCodeAt(0) === 0xFEFF || recovered.charCodeAt(0) === 0xFFFE) {
  recovered = recovered.slice(1);
}
recovered = recovered.replace(/^[^a-zA-Z]*/, '');

const startStr = "app.post('/api/scan', async (req, res) => {";
const endStr = "app.post('/api/admin/login'";

const startIndex = recovered.indexOf(startStr);
const endIndex = recovered.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const scanLogic = recovered.substring(startIndex, endIndex);
  
  let current = fs.readFileSync('server/index.js', 'utf8');
  const currentStartIndex = current.indexOf(startStr);
  const currentEndIndex = current.indexOf(endStr);
  
  if (currentStartIndex !== -1 && currentEndIndex !== -1) {
    current = current.substring(0, currentStartIndex) + scanLogic + current.substring(currentEndIndex);
    fs.writeFileSync('server/index.js', current);
    console.log('Restored /api/scan perfectly!');
  } else {
    console.log('Could not find bounds in current index.js');
  }
} else {
  console.log('Could not find bounds in recovered file');
}
