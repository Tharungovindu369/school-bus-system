const fs = require('fs');
const path = require('path');
const dir = `C:\\Users\\tharu\\.gemini\\antigravity\\brain\\b9f6b3d5-dbd9-4806-8c0a-0409580e1aca\\.system_generated\\tasks`;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.log'));
let modifiedStudents = new Set();
let busUpdates = new Set();
let feeUpdates = new Set();
let bulkUpdates = new Set();

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  // Regex to match [Bus Update] Successfully updated bus for S0001 to Bus 2.
  const busMatches = content.matchAll(/\[Bus Update\] Successfully updated bus for (S\d+) to/g);
  for (const match of busMatches) {
    busUpdates.add(match[1]);
    modifiedStudents.add(match[1]);
  }
  
  // Regex to match [Fee Update] Successfully updated Google Sheets for S0001.
  const feeMatches = content.matchAll(/\[Fee Update\] Successfully updated Google Sheets for (S\d+)/g);
  for (const match of feeMatches) {
    feeUpdates.add(match[1]);
    modifiedStudents.add(match[1]);
  }
}

console.log("Bus Updates:", Array.from(busUpdates));
console.log("Fee Updates:", Array.from(feeUpdates));
console.log("Total Modified Students:", Array.from(modifiedStudents));
