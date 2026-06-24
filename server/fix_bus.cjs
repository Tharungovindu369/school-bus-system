const fs = require('fs');

let code = fs.readFileSync('server/services/sheets.js', 'utf8');

if (!code.includes('busNumberKey')) {
  code = code.replace(/import \{ config \} from '\.\.\/config\.js';/, "import { config } from '../config.js';\nimport { busNumberKey } from '../utils.js';");
  
  // Replace exact string matches
  code = code.replace(/String\(b\.bus_number\) === String\(busNumber\)/g, 'busNumberKey(b.bus_number) === busNumberKey(busNumber)');
  code = code.replace(/String\(s\.default_bus\) === String\(busNumber\) \|\| String\(s\.assigned_bus\) === String\(busNumber\) \|\| String\(s\.bus_number\) === String\(busNumber\)/g, 'busNumberKey(s.default_bus) === busNumberKey(busNumber) || busNumberKey(s.assigned_bus) === busNumberKey(busNumber) || busNumberKey(s.bus_number) === busNumberKey(busNumber)');
  
  fs.writeFileSync('server/services/sheets.js', code);
  console.log('Fixed bus number comparisons');
} else {
  console.log('Already fixed');
}
