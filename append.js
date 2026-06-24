
export function clearCache(key) {}

export async function appendAuditLog(actionType, target, newValue, reason = '') {
  try {
    const sheets = await getSheets();
    const values = [[
      new Date().toISOString(),
      actionType,
      target,
      newValue,
      reason
    ]];
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetsId,
      range: 'AuditLog!A:E',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
}
