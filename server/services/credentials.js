import { getSheets, getSheetData, clearCache } from './sheets.js';
import { config as configValues, getDriverPins as fallbackGetDriverPins } from '../config.js';

let credentialsCache = null;
let credentialsCacheTime = 0;
const CACHE_TTL = 60000;

async function ensureCredentialsSheet() {
  const sheets = await getSheets();
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: configValues.googleSheetsId,
    });
    
    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === 'Credentials'
    );

    if (!sheetExists) {
      console.log('[Credentials] Creating new Credentials sheet...');
      // Create the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: configValues.googleSheetsId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: 'Credentials' }
            }
          }]
        }
      });
      
      // Populate defaults
      const defaults = [
        ['Type', 'Key', 'Value'],
        ['Admin', 'adminPassword', configValues.adminPassword || 'admin123'],
        ['Accountant', 'accountantPin', '1234'],
        ['BusIncharge', 'busInchargePin', '5678'],
        ['Reception', 'receptionPin', configValues.receptionPin || '9999']
      ];
      
      const driverPins = fallbackGetDriverPins();
      for (const [bus, pin] of Object.entries(driverPins)) {
        defaults.push(['Driver', bus, pin]);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: configValues.googleSheetsId,
        range: 'Credentials!A1:C',
        valueInputOption: 'RAW',
        requestBody: { values: defaults }
      });
      console.log('[Credentials] Default credentials populated in Google Sheets.');
    }
  } catch (err) {
    console.error('[Credentials] Error ensuring credentials sheet:', err);
  }
}

export async function loadCredentials() {
  if (credentialsCache && Date.now() - credentialsCacheTime < CACHE_TTL) {
    return credentialsCache;
  }

  try {
    const rows = await getSheetData('Credentials!A:C');
    if (!rows || rows.length === 0) {
      throw new Error('Sheet empty or does not exist');
    }

    const creds = { driverPins: {} };
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const [type, key, value] = rows[i];
      if (type === 'Admin' && key === 'adminPassword') creds.adminPassword = value;
      if (type === 'Accountant' && key === 'accountantPin') creds.accountantPin = value;
      if (type === 'BusIncharge' && key === 'busInchargePin') creds.busInchargePin = value;
      if (type === 'Reception' && key === 'receptionPin') creds.receptionPin = value;
      if (type === 'Driver') creds.driverPins[key] = value;
    }
    
    credentialsCache = creds;
    credentialsCacheTime = Date.now();
    return creds;
  } catch (err) {
    console.log('[Credentials] Loading failed, initializing sheet...');
    await ensureCredentialsSheet();
    clearCache('Credentials!A:C'); // Clear sheetCache just in case
    // Read again
    const rows = await getSheetData('Credentials!A:C');
    const creds = { driverPins: {} };
    for (let i = 1; i < rows.length; i++) {
      const [type, key, value] = rows[i];
      if (type === 'Admin' && key === 'adminPassword') creds.adminPassword = value;
      if (type === 'Accountant' && key === 'accountantPin') creds.accountantPin = value;
      if (type === 'BusIncharge' && key === 'busInchargePin') creds.busInchargePin = value;
      if (type === 'Reception' && key === 'receptionPin') creds.receptionPin = value;
      if (type === 'Driver') creds.driverPins[key] = value;
    }
    credentialsCache = creds;
    credentialsCacheTime = Date.now();
    return creds;
  }
}

export async function getAdminPassword() {
  const creds = await loadCredentials();
  return creds.adminPassword;
}

export async function getReceptionPin() {
  const creds = await loadCredentials();
  return creds.receptionPin;
}

export async function getAccountantPin() {
  const creds = await loadCredentials();
  return creds.accountantPin;
}

export async function getBusInchargePin() {
  const creds = await loadCredentials();
  return creds.busInchargePin;
}

export async function getDriverPins() {
  const creds = await loadCredentials();
  return creds.driverPins;
}

export async function updateCredential(type, key, value) {
  // First, get all current to find the row or append
  await loadCredentials();
  const sheets = await getSheets();
  const rows = await getSheetData('Credentials!A:C');
  
  let targetType = '';
  let targetKey = key;
  if (type === 'adminPassword') {
    targetType = 'Admin';
    targetKey = 'adminPassword';
  } else if (type === 'accountantPin') {
    targetType = 'Accountant';
    targetKey = 'accountantPin';
  } else if (type === 'busInchargePin') {
    targetType = 'BusIncharge';
    targetKey = 'busInchargePin';
  } else if (type === 'receptionPin') {
    targetType = 'Reception';
    targetKey = 'receptionPin';
  } else if (type === 'driverPin') {
    targetType = 'Driver';
  }

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === targetType && rows[i][1] === targetKey) {
      rowIndex = i + 1; // 1-indexed for sheets
      break;
    }
  }

  if (rowIndex !== -1) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: configValues.googleSheetsId,
      range: `Credentials!C${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] }
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: configValues.googleSheetsId,
      range: 'Credentials!A:C',
      valueInputOption: 'RAW',
      requestBody: { values: [[targetType, targetKey, value]] }
    });
  }

  // Invalidate cache
  credentialsCache = null;
  credentialsCacheTime = 0;
  clearCache('Credentials!A:C');
}

export async function getAllCredentials() {
  return await loadCredentials();
}

export async function verifyCredential(plainText, storedHash) {
  if (!storedHash) return false;
  return plainText === storedHash;
}

// Migration removed since we are storing plain text
export async function migrateCredentials() {
  return;
}
