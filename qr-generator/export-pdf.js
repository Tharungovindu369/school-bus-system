import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, 'output', 'qr-cards.html');
const PDF_PATH  = path.join(__dirname, 'output', 'qr-cards.pdf');

async function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error('ERROR: qr-cards.html not found. Run generate.js first.');
    process.exit(1);
  }

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();

  // Load the local HTML file
  const fileUrl = 'file:///' + HTML_PATH.replace(/\\/g, '/');
  console.log('Loading:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  console.log('Generating PDF...');
  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();

  const sizeMB = (fs.statSync(PDF_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\nDone! PDF saved to:\n  ${PDF_PATH}`);
  console.log(`  Size: ${sizeMB} MB`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
