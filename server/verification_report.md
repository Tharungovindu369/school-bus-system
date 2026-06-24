# Exhaustive Verification Report

**Total Passed:** 13
**Total Failed:** 0

| Category | Description | Expected | Actual | Status |
|---|---|---|---|---|
| 1. NEW ROLE SECURITY | Accountant: GET /incidents | 403 Forbidden | 403 {"error":"Forbidden: Admin access required"} | ✅ PASS |
| 1. NEW ROLE SECURITY | Accountant: PUT /students/:id/bus | 403 Forbidden | 403 {"error":"Forbidden: Admin access required"} | ✅ PASS |
| 1. NEW ROLE SECURITY | Accountant: GET /reassignments/active | 403 Forbidden | 403 {"error":"Forbidden: Bus Incharge access required"} | ✅ PASS |
| 1. NEW ROLE SECURITY | Bus Incharge: PUT /fee/:id | 403 Forbidden | 403 {"error":"Forbidden: Accountant access required"} | ✅ PASS |
| 1. NEW ROLE SECURITY | Bus Incharge: GET /admin/student/:id | 403 Forbidden | 403 {"error":"Forbidden: Accountant access required"} | ✅ PASS |
| 3. NEW STUDENT + QR FLOW | Add New Student | 200 OK + success:true | 200 {"success":true,"student":{"student_id":"TEST_QA_401","name":"QA Test Student","class":"10A","bus_number":"Bus 1","stop_name":"QA Stop","parent_name":"","parent_whatsapp":"1234567890","fee_status":"DUE","fee_paid_until":"","lookup_phone_last4":""}} | ✅ PASS |
| 3. NEW STUDENT + QR FLOW | Duplicate Student Rejection | 400 Bad Request | 400 {"error":"Student ID already exists"} | ✅ PASS |
| 3. NEW STUDENT + QR FLOW | QR Layout Minimal | Contains ID, Name, Phone. NO Class, NO Bus. | Matches criteria: true | ✅ PASS |
| 2. GATE SCANNER (Yellow/Green/Red) | Not Scanned + Due | isDue: true, driverScanned: false | isDue: true, driverScanned: false | ✅ PASS |
| 2. GATE SCANNER (Yellow/Green/Red) | Not Scanned + Paid | isDue: false, driverScanned: false | isDue: false, driverScanned: false | ✅ PASS |
| 2. GATE SCANNER (Yellow/Green/Red) | Driver Scanned + Due | isDue: true, driverScanned: true | isDue: true, driverScanned: true | ✅ PASS |
| 2. GATE SCANNER (Yellow/Green/Red) | Driver Scanned + Paid | isDue: false, driverScanned: true | isDue: false, driverScanned: true | ✅ PASS |
| 4. REGRESSION | Rate Limiting on Login | 429 Too Many Requests (approx 6th attempt) | Hit at attempt 6 | ✅ PASS |