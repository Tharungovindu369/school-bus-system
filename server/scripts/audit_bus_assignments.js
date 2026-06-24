import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStudents } from '../services/sheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'bus_audit_report.csv');

async function runAudit() {
  console.log('Fetching students from Google Sheets...');
  const students = await getStudents();
  console.log(`Fetched ${students.length} students.\n`);

  const busCounts = {};
  const suspicious = [];
  
  students.forEach(student => {
    let bus = student.bus_number;
    if (bus === undefined || bus === null || bus.toString().trim() === '') {
      bus = 'BLANK';
    } else {
      bus = bus.toString().trim();
    }

    busCounts[bus] = (busCounts[bus] || 0) + 1;
    
    // Check format
    if (bus === 'BLANK') {
      suspicious.push(`Student ${student.student_id} (${student.name}) has blank/missing bus number.`);
    } else if (!/^Bus\s*\d+$/i.test(bus) && !/^B\d+$/i.test(bus) && !/^\d+$/.test(bus)) {
      suspicious.push(`Student ${student.student_id} (${student.name}) has malformed bus number: "${bus}"`);
    }
  });

  // Sort buses numerically then alphabetically
  const sortedBuses = Object.keys(busCounts).sort((a, b) => {
    const numA = parseInt((a.match(/\d+/) || [0])[0]);
    const numB = parseInt((b.match(/\d+/) || [0])[0]);
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  const tableData = sortedBuses.map(bus => {
    const count = busCounts[bus];
    let note = '';
    if (count > 250) note = '⚠️ UNUSUALLY HIGH (Fallback?)';
    else if (count < 30 && bus !== 'BLANK') note = 'ℹ️ Low count';
    
    return {
      'Bus Number': bus,
      'Student Count': count,
      'Notes': note
    };
  });

  console.log('=== BUS ASSIGNMENT SUMMARY ===');
  console.table(tableData);

  console.log('\n=== SUSPICIOUS PATTERNS ===');
  if (suspicious.length > 0) {
    suspicious.slice(0, 20).forEach(s => console.log(s));
    if (suspicious.length > 20) {
      console.log(`... and ${suspicious.length - 20} more suspicious records.`);
    }
  } else {
    console.log('No malformed or blank bus numbers found.');
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Sort students for CSV
  const sortedStudents = [...students].sort((a, b) => {
    const busA = (a.bus_number || 'BLANK').toString().trim();
    const busB = (b.bus_number || 'BLANK').toString().trim();
    
    if (busA !== busB) {
      const numA = parseInt((busA.match(/\d+/) || [0])[0]);
      const numB = parseInt((busB.match(/\d+/) || [0])[0]);
      if (numA !== numB) return numA - numB;
      return busA.localeCompare(busB);
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  const csvRows = ['student_id,name,bus_number'];
  sortedStudents.forEach(s => {
    const id = s.student_id || '';
    const name = `"${(s.name || '').replace(/"/g, '""')}"`;
    const bus = `"${(s.bus_number || '').toString().replace(/"/g, '""')}"`;
    csvRows.push(`${id},${name},${bus}`);
  });

  fs.writeFileSync(OUTPUT_FILE, csvRows.join('\n'), 'utf8');
  console.log(`\nAudit complete! Full report saved to: ${OUTPUT_FILE}`);
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
