const fs = require('fs');
let code = fs.readFileSync('server/temp.js', 'utf8');

const missingHeader = `app.post('/api/lookup', lookupLimiter, async (req, res) => {
  try {
    const { student_id, last4 } = req.body;
    if (!student_id || !last4) {
      return res.status(400).json({ error: 'Student ID and 4-digit PIN required' });
    }
`;

code = code.replace(`      const student = await sheets.getStudentById(student_id.trim().toUpperCase());
      if (!student) {`, missingHeader + `      const student = await sheets.getStudentById(student_id.trim().toUpperCase());
      if (!student) {`);

fs.writeFileSync('server/temp.js', code);
console.log('Fixed missing header');
