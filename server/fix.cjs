const fs = require('fs');
const lines = fs.readFileSync('services/sheets.js', 'utf8').split('\n');

const newTop = `import { google } from 'googleapis';
import { config } from '../config.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheetsClient = null;

function busNumberKey(bus) {
  if (bus == null || bus === '') return '';
  return String(bus).replace(/^bus\\s*/i, '').trim();
}

function getAuth() {
  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: SCOPES,
  });
}

export async function getSheets() {
  if (!sheetsClient) {
    const auth = getAuth();
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

`;

// Find where getSheetData starts and append from there
const idx = lines.findIndex(l => l.includes('export async function getSheetData'));
const remaining = lines.slice(idx).join('\n');

fs.writeFileSync('services/sheets.js', newTop + remaining);
