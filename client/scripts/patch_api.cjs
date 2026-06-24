const fs = require('fs');

let content = fs.readFileSync('src/api.js', 'utf8');

const authHeaderHelper = `
function getAuthHeader(auth) {
  if (!auth) return {};
  // If it's a string, it's legacy admin password
  if (typeof auth === 'string') return { 'x-admin-password': auth };
  if (auth.role === 'admin') return { 'x-admin-password': auth.token };
  if (auth.role === 'accountant') return { 'x-accountant-pin': auth.token };
  if (auth.role === 'bus_incharge') return { 'x-bus-incharge-pin': auth.token };
  return {};
}
`;

content = content.replace('export const api = {', authHeaderHelper + '\nexport const api = {');

// Login endpoints
const loginEndpoints = `  adminLogin: (password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  accountantLogin: (pin) =>
    request('/accountant/login', { method: 'POST', body: JSON.stringify({ pin }) }),
  busInchargeLogin: (pin) =>
    request('/bus-incharge/login', { method: 'POST', body: JSON.stringify({ pin }) }),`;

content = content.replace(
  "  adminLogin: (password) =>\n    request('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),",
  loginEndpoints
);

// Replace headers: { 'x-admin-password': password } with ...getAuthHeader(password)
// Wait, the parameter in api.js is named 'password'. Let's rename it 'auth' for clarity or just keep it 'password' but treat it as auth.
content = content.replace(/headers: \{ 'x-admin-password': password \}/g, 'headers: getAuthHeader(password)');

// Add API endpoints for QR and Add Student
const addStudentEndpoint = `
  addStudent: (auth, data) => request('/students', { method: 'POST', headers: getAuthHeader(auth), body: JSON.stringify(data) }),
`;

content = content.replace('  receptionScan: (student_id) =>', addStudentEndpoint + '  receptionScan: (student_id) =>');

fs.writeFileSync('src/api.js', content);
console.log('api.js patched');
