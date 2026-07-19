import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parsePrivateKey(raw) {
  if (!raw) return '';
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n').replace(/,\s*$/, '').trim();
  return key;
}

function loadGoogleCredentials() {
  const credPath = path.resolve(__dirname, '../credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (creds.private_key && creds.private_key !== 'PLACEHOLDER') {
        return {
          email: creds.client_email,
          privateKey: parsePrivateKey(creds.private_key),
        };
      }
    } catch { /* fall through */ }
  }
  return {
    email: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
    privateKey: parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY || ''),
  };
}

const googleCreds = loadGoogleCredentials();

export const config = {
  port: process.env.PORT || 3002,
  schoolName: (process.env.SCHOOL_NAME || 'School Transport').trim(),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  googleSheetsId: process.env.GOOGLE_SHEETS_ID,
  watiApiKey: process.env.WATI_API_KEY || '',
  watiApiEndpoint: process.env.WATI_API_ENDPOINT || '',
  googleServiceAccountEmail: googleCreds.email,
  googlePrivateKey: googleCreds.privateKey,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  dropoffCutoffTime: process.env.DROPOFF_CUTOFF_TIME || '15:00',
  notDroppedAlertTime: process.env.NOT_DROPPED_ALERT_TIME || '17:00',
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  receptionPin: process.env.RECEPTION_PIN || '9999',
  adminWhatsapp: process.env.ADMIN_WHATSAPP || '',
};

export function getDriverPins() {
  if (process.env.DRIVER_PINS) {
    try {
      return JSON.parse(process.env.DRIVER_PINS);
    } catch {
      console.warn('Invalid DRIVER_PINS JSON, using defaults');
    }
  }
  const pins = {};
  for (let i = 1; i <= 18; i++) {
    pins[String(i)] = String(i).padStart(4, '0');
  }
  return pins;
}
