const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const missingCode = `}));

app.get('/api/driver/pins', (_req, res) => {
  const pins = getDriverPins();
  res.json({ buses: Object.keys(pins) });
});

`;

code = code.replace(/      callback\(new Error\('Not allowed by CORS'\)\);\r?\n    }\r?\n  }\r?\napp\.get\('\/api\/students'/g, "      callback(new Error('Not allowed by CORS'));\n    }\n  }\n" + missingCode + "app.get('/api/students'");

fs.writeFileSync('server/index.js', code);
console.log('Fixed CORS and re-inserted pins route');
