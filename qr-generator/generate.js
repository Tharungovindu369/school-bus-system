import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, 'output');
const PNG_DIR = path.join(OUTPUT_DIR, 'qr-codes');

const config = {
  googleSheetsId: process.env.GOOGLE_SHEETS_ID,
  googleServiceAccountEmail: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  schoolName: process.env.SCHOOL_NAME || 'School Transport',
};

async function getStudents() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: 'Students!A:I',
  });
  const rows = response.data.values || [];
  if (!rows.length) return [];
  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = row[i] ?? ''; });
      return obj;
    })
    .filter(obj => {
      const num = Number(String(obj.bus_number).replace(/^bus\s*/i, '').trim());
      return num >= 1 && num <= 13;
    });
}

function sanitizeFilename(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatBusNumber(bus) {
  const key = String(bus).replace(/^bus\s*/i, '').trim();
  return key ? `Bus ${key}` : '';
}

async function generateQRCodes(students) {
  fs.mkdirSync(PNG_DIR, { recursive: true });
  const cards = [];

  for (const student of students) {
    // QR encodes ONLY the student_id — nothing else
    const payload = student.student_id;

    const filename = `${student.student_id}.png`;
    const filepath = path.join(PNG_DIR, filename);

    await QRCode.toFile(filepath, payload, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    });

    const dataUrl = await QRCode.toDataURL(payload, { width: 200, margin: 1 });
    cards.push({ student, filename, dataUrl });
    console.log(`Generated: ${filename}`);
  }

  return cards;
}

function generateHTML(cards) {
  const PER_PAGE = 21; // 3 columns × 7 rows

  // Split into pages of 21
  const pages = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) {
    pages.push(cards.slice(i, i + PER_PAGE));
  }

  const pagesHtml = pages.map((page, pageIdx) => {
    const labelsHtml = page.map(({ student, dataUrl }) => `
      <div class="label">
        <img src="${dataUrl}" alt="QR ${student.student_id}" />
        <div class="sid">${student.student_id}</div>
      </div>`).join('');
    return `<div class="page">${labelsHtml}</div>`;
  }).join('');

  const totalPages = pages.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Student QR Labels - ${config.schoolName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #e2e8f0; }

    /* ── On-screen toolbar ─────────────────────────────── */
    .toolbar {
      background: #2563eb; color: white; padding: 12px 20px;
      display: flex; align-items: center; gap: 12px;
      position: sticky; top: 0; z-index: 10;
    }
    .toolbar h1 { font-size: 16px; }
    .toolbar button {
      background: white; color: #2563eb; border: none; border-radius: 6px;
      padding: 8px 18px; font-weight: bold; cursor: pointer; font-size: 14px;
    }
    .toolbar .note { font-size: 12px; opacity: 0.85; margin-left: auto; }

    /* ── Each page is exactly A4 ───────────────────────── */
    .page {
      width: 210mm;
      height: 297mm;
      margin: 12px auto;
      background: white;
      padding: 10mm 10mm;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(7, 1fr);
      gap: 3mm;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* ── Individual label ──────────────────────────────── */
    .label {
      border: 0.5px solid #cbd5e1;
      border-radius: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5mm;
      overflow: hidden;
      background: white;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .label img {
      width: 25mm;
      height: 25mm;
    }
    .sid {
      font-size: 9pt;
      font-weight: bold;
      color: #1e3a5f;
      text-align: center;
      white-space: nowrap;
    }

    /* ── Print overrides ───────────────────────────────── */
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page {
        margin: 0;
        box-shadow: none;
        border: none;
      }
      .label { border-color: #aaa; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>🚌 ${config.schoolName} — QR Labels</h1>
    <button onclick="window.print()">🖨️ Print</button>
    <span class="note">
      21 per page (3 × 7) &nbsp;|&nbsp;
      ${cards.length} students &nbsp;|&nbsp;
      ${totalPages} page${totalPages !== 1 ? 's' : ''}
    </span>
  </div>
  ${pagesHtml}
</body>
</html>`;
}

async function main() {
  console.log('Fetching students from Google Sheets...');
  const students = await getStudents();
  if (!students.length) {
    console.log('No students found in sheet.');
    return;
  }
  console.log(`Found ${students.length} students. Generating QR codes...`);
  const cards = await generateQRCodes(students);
  const html = generateHTML(cards);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const htmlPath = path.join(OUTPUT_DIR, 'qr-cards.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`\nDone! Generated ${cards.length} QR codes.`);
  console.log(`PNG files: ${PNG_DIR}`);
  console.log(`Printable HTML: ${htmlPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
