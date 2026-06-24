const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const badBlock = `        if (!student.lookup_phone_last4 && !student.parent_whatsapp) {
          return res.status(401).json({ error: 'Lookup not yet set up for this student - please contact admin' });
        }
  
        const actualPhone = String(student.parent_whatsapp || '').trim();
        const phoneLast4 = actualPhone.length >= 4 ? actualPhone.slice(-4) : null;
        const adminSetLast4 = student.lookup_phone_last4;

        if (last4 !== phoneLast4 && last4 !== adminSetLast4) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }`;

code = code.replace(badBlock, '  }');

const oldLookup = `        if (!student.lookup_phone_last4) {
          return res.status(401).json({ error: 'Lookup not yet set up for this student — please contact admin' });
        }
  
        if (student.lookup_phone_last4 !== last4) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }`;

const newLookup = `        const actualPhone = String(student.parent_whatsapp || '').trim();
        const phoneLast4 = actualPhone.length >= 4 ? actualPhone.slice(-4) : null;
        const adminSetLast4 = student.lookup_phone_last4;

        if (!phoneLast4 && !adminSetLast4) {
          return res.status(401).json({ error: 'Phone number not set up for this student. Please contact admin' });
        }

        if (last4 !== phoneLast4 && last4 !== adminSetLast4) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }`;

code = code.replace(oldLookup, newLookup);

fs.writeFileSync('server/index.js', code);
console.log('Fixed syntax error in index.js');
