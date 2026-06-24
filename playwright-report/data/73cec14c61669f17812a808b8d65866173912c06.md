# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-features.spec.mjs >> Admin & Driver Features >> Test 3: Cross-Bus Color Logic
- Location: tests\admin-features.spec.mjs:87:3

# Error details

```
Error: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user' of service 'sheets.googleapis.com' for consumer 'project_number:1031739544711'.
```

```
Error: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user' of service 'sheets.googleapis.com' for consumer 'project_number:1031739544711'.
```

# Test source

```ts
  1   | import { google } from 'googleapis';
  2   | import { config } from '../config.js';
  3   | import {
  4   |   busNumberKey,
  5   |   formatBusNumber,
  6   |   getISTDateString,
  7   |   isNotDroppedAlertTime,
  8   |   parseSheetDate,
  9   |   parseSheetTime,
  10  |   isFeeDue,
  11  | } from '../utils.js';
  12  | 
  13  | const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  14  | 
  15  | let sheetsClient = null;
  16  | 
  17  | function getAuth() {
  18  |   return new google.auth.JWT({
  19  |     email: config.googleServiceAccountEmail,
  20  |     key: config.googlePrivateKey,
  21  |     scopes: SCOPES,
  22  |   });
  23  | }
  24  | 
  25  | async function getSheets() {
  26  |   if (!sheetsClient) {
  27  |     const auth = getAuth();
  28  |     sheetsClient = google.sheets({ version: 'v4', auth });
  29  |   }
  30  |   return sheetsClient;
  31  | }
  32  | 
  33  | const CACHE_TTL = 15000; // 15 seconds
  34  | const cache = new Map();
  35  | 
  36  | export function clearCache(range) {
  37  |   if (range) {
  38  |     cache.delete(range);
  39  |   } else {
  40  |     cache.clear();
  41  |   }
  42  | }
  43  | 
  44  | async function getSheetData(range) {
  45  |   const now = Date.now();
  46  |   if (cache.has(range) && (now - cache.get(range).timestamp < CACHE_TTL)) {
  47  |     return cache.get(range).data;
  48  |   }
  49  | 
  50  |   const sheets = await getSheets();
> 51  |   const response = await sheets.spreadsheets.values.get({
      |                    ^ Error: Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user' of service 'sheets.googleapis.com' for consumer 'project_number:1031739544711'.
  52  |     spreadsheetId: config.googleSheetsId,
  53  |     range,
  54  |   });
  55  |   
  56  |   const data = response.data.values || [];
  57  |   cache.set(range, { data, timestamp: now });
  58  |   return data;
  59  | }
  60  | 
  61  | function rowsToObjects(rows) {
  62  |   if (!rows.length) return [];
  63  |   const [headers, ...dataRows] = rows;
  64  |   return dataRows
  65  |     .filter((row) => row.some((cell) => cell !== undefined && cell !== ''))
  66  |     .map((row) => {
  67  |       const obj = {};
  68  |       headers.forEach((header, i) => {
  69  |         obj[header.trim()] = row[i] ?? '';
  70  |       });
  71  |       return obj;
  72  |     });
  73  | }
  74  | 
  75  | function findBusRowIndex(records, busNumber) {
  76  |   const key = busNumberKey(busNumber);
  77  |   return records.findIndex((b) => busNumberKey(b.bus_number) === key);
  78  | }
  79  | 
  80  | export async function getStudents() {
  81  |   const rows = await getSheetData('Students!A:J');
  82  |   return rowsToObjects(rows).map((s) => ({
  83  |     ...s,
  84  |     bus_number: formatBusNumber(s.bus_number),
  85  |   }));
  86  | }
  87  | 
  88  | export async function getStudentById(studentId) {
  89  |   const students = await getStudents();
  90  |   return students.find((s) => s.student_id === studentId);
  91  | }
  92  | 
  93  | export async function getStudentsByBus(busNumber) {
  94  |   const students = await getStudents();
  95  |   const key = busNumberKey(busNumber);
  96  |   return students.filter((s) => busNumberKey(s.bus_number) === key);
  97  | }
  98  | 
  99  | export async function getBuses() {
  100 |   const { revertExpiredReassignments } = await import('./reassignments.js');
  101 |   await revertExpiredReassignments();
  102 |   const rows = await getSheetData('Buses!A:N');
  103 |   return rowsToObjects(rows).map((b) => ({
  104 |     ...b,
  105 |     bus_number: formatBusNumber(b.bus_number),
  106 |     journey_type: b.journey_type || 'idle',
  107 |     current_status: b.current_status || 'idle',
  108 |   }));
  109 | }
  110 | 
  111 | export async function getBusByNumber(busNumber) {
  112 |   const buses = await getBuses();
  113 |   const key = busNumberKey(busNumber);
  114 |   return buses.find((b) => busNumberKey(b.bus_number) === key);
  115 | }
  116 | 
  117 | export async function getAttendance(dateFilter = null) {
  118 |   const rows = await getSheetData('Attendance!A:P');
  119 |   const records = rowsToObjects(rows).map((r) => ({
  120 |     ...r,
  121 |     date: parseSheetDate(r.date),
  122 |     boarded_at: parseSheetTime(r.boarded_at),
  123 |     dropoff_time: parseSheetTime(r.dropoff_time),
  124 |     arrival_time: parseSheetTime(r.arrival_time),
  125 |     bus_number: formatBusNumber(r.bus_number),
  126 |     actual_bus: r.actual_bus ? formatBusNumber(r.actual_bus) : '',
  127 |     assigned_bus: r.assigned_bus ? formatBusNumber(r.assigned_bus) : '',
  128 |     scan_type: r.scan_type || 'boarding',
  129 |   }));
  130 |   if (!dateFilter) return records;
  131 |   return records.filter((r) => r.date === dateFilter);
  132 | }
  133 | 
  134 | export async function getTodayAttendance() {
  135 |   return getAttendance(getISTDateString());
  136 | }
  137 | 
  138 | export async function findAttendanceRecord(studentId, busNumber, date, scanType) {
  139 |   const records = await getAttendance(date);
  140 |   if (scanType === 'college_arrival') {
  141 |     return records.find(
  142 |       (r) => r.student_id === studentId && r.scan_type === 'college_arrival'
  143 |     );
  144 |   }
  145 |   const busKey = busNumberKey(busNumber);
  146 |   return records.find(
  147 |     (r) =>
  148 |       r.student_id === studentId &&
  149 |       busNumberKey(r.bus_number) === busKey &&
  150 |       (r.scan_type || 'boarding') === scanType
  151 |   );
```