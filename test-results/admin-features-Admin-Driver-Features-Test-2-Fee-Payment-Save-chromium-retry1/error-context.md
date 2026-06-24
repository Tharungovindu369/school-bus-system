# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-features.spec.mjs >> Admin & Driver Features >> Test 2: Fee Payment Save
- Location: tests\admin-features.spec.mjs:59:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "PAID"
Received: ""
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - heading "Admin Dashboard" [level=1] [ref=e5]
      - button "Logout" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - button "overview" [ref=e8] [cursor=pointer]
      - button "attendance" [ref=e9] [cursor=pointer]
      - button "students" [ref=e10] [cursor=pointer]
      - button "incidents" [ref=e11] [cursor=pointer]
      - button "buses" [ref=e12] [cursor=pointer]
      - button "Bus Reassignment" [ref=e13] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]:
        - textbox "Search students..." [ref=e17]: S0001
        - button "ALL" [ref=e18] [cursor=pointer]
        - button "PAID" [ref=e19] [cursor=pointer]
        - button "DUE" [ref=e20] [cursor=pointer]
        - button "Bulk Set Fee Paid Until" [ref=e21] [cursor=pointer]
        - button "Export Unpaid Report" [ref=e22] [cursor=pointer]
      - table [ref=e24]:
        - rowgroup [ref=e25]:
          - row "ID Name Class Bus Stop Fee Status Action" [ref=e26]:
            - columnheader [ref=e27]:
              - checkbox [ref=e28]
            - columnheader "ID" [ref=e29]
            - columnheader "Name" [ref=e30]
            - columnheader "Class" [ref=e31]
            - columnheader "Bus" [ref=e32]
            - columnheader "Stop" [ref=e33]
            - columnheader "Fee Status" [ref=e34]
            - columnheader "Action" [ref=e35]
        - rowgroup [ref=e36]:
          - 'row "S0001 M JASHWANTH 2nd Year 12177 Bus 1 YENUGONDA PAID Until: 2026-12-20 Update Payment Change Bus" [ref=e37] [cursor=pointer]':
            - cell [ref=e38]:
              - checkbox [ref=e39]
            - cell "S0001" [ref=e40]
            - cell "M JASHWANTH" [ref=e41]
            - cell "2nd Year 12177" [ref=e42]
            - cell "Bus 1" [ref=e43]
            - cell "YENUGONDA" [ref=e44]
            - 'cell "PAID Until: 2026-12-20" [ref=e45]':
              - text: PAID
              - generic [ref=e46]: "Until: 2026-12-20"
            - cell "Update Payment Change Bus" [ref=e47]:
              - button "Update Payment" [ref=e48]
              - button "Change Bus" [ref=e49]
  - status [ref=e55]: Fee status updated successfully
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { updateStudentFeeStatus, updateStudentBusNumber, getStudentById, clearCache, getBusByNumber } from '../server/services/sheets.js';
  3   | import { config } from '../server/config.js';
  4   | import dotenv from 'dotenv';
  5   | import path from 'path';
  6   | 
  7   | // Load .env explicitly for tests
  8   | import { fileURLToPath } from 'url';
  9   | const __filename = fileURLToPath(import.meta.url);
  10  | const __dirname = path.dirname(__filename);
  11  | dotenv.config({ path: path.resolve(__dirname, '../server/.env') });
  12  | 
  13  | test.describe('Admin & Driver Features', () => {
  14  |   const TEST_STUDENT_ID = 'S0001';
  15  |   const BASE_BUS = 'Bus 1';
  16  | 
  17  |   test.beforeEach(async () => {
  18  |     // Reset the test student to a known baseline
  19  |     await updateStudentBusNumber(TEST_STUDENT_ID, BASE_BUS);
  20  |     await updateStudentFeeStatus(TEST_STUDENT_ID, '');
  21  |     clearCache();
  22  |   });
  23  | 
  24  |   test.afterEach(async () => {
  25  |     // Clean up after tests
  26  |     await updateStudentBusNumber(TEST_STUDENT_ID, BASE_BUS);
  27  |     await updateStudentFeeStatus(TEST_STUDENT_ID, '');
  28  |     clearCache();
  29  |   });
  30  | 
  31  |   test('Test 1: Change Bus Feature', async ({ page }) => {
  32  |     await page.goto('/admin');
  33  |     await page.fill('input[type="password"]', config.adminPassword);
  34  |     await page.click('button[type="submit"]');
  35  | 
  36  |     await page.click('button:has-text("Students")');
  37  |     await expect(page.locator('table')).toBeVisible();
  38  | 
  39  |     await page.fill('input[placeholder*="Search"]', TEST_STUDENT_ID);
  40  | 
  41  |     const row = page.locator('tr', { hasText: TEST_STUDENT_ID }).first();
  42  |     await expect(row).toBeVisible();
  43  | 
  44  |     await row.locator('button', { hasText: 'Change Bus' }).click();
  45  | 
  46  |     const modal = page.locator('.fixed.inset-0', { hasText: 'Change Bus' });
  47  |     await expect(modal).toBeVisible();
  48  |     await modal.locator('select').selectOption('Bus 2');
  49  |     await modal.locator('button[type="submit"]').click();
  50  | 
  51  |     await expect(page.getByText('Bus updated for student', { exact: false })).toBeVisible();
  52  |     await expect(row).toContainText('Bus 2');
  53  | 
  54  |     clearCache();
  55  |     const dbStudent = await getStudentById(TEST_STUDENT_ID);
  56  |     expect(dbStudent.bus_number).toBe('Bus 2');
  57  |   });
  58  | 
  59  |   test('Test 2: Fee Payment Save', async ({ page }) => {
  60  |     await page.goto('/admin');
  61  |     await page.fill('input[type="password"]', config.adminPassword);
  62  |     await page.click('button[type="submit"]');
  63  | 
  64  |     await page.click('button:has-text("Students")');
  65  |     await page.fill('input[placeholder*="Search"]', TEST_STUDENT_ID);
  66  |     const row = page.locator('tr', { hasText: TEST_STUDENT_ID }).first();
  67  |     await expect(row).toBeVisible();
  68  | 
  69  |     await row.locator('button', { hasText: 'Update Payment' }).click();
  70  | 
  71  |     const modal = page.locator('.fixed.inset-0', { hasText: 'Update Fee Status' });
  72  |     await expect(modal).toBeVisible();
  73  |     await modal.locator('select').selectOption('3');
  74  |     await modal.locator('button:has-text("Save Payment")').click();
  75  | 
  76  |     await expect(page.getByText('Fee status updated successfully', { exact: false })).toBeVisible();
  77  | 
  78  |     await expect(row.locator('.bg-paid')).toBeVisible();
  79  |     await expect(row.locator('.bg-paid')).toContainText('PAID');
  80  | 
  81  |     clearCache();
  82  |     const dbStudent = await getStudentById(TEST_STUDENT_ID);
> 83  |     expect(dbStudent.fee_status).toBe('PAID');
      |                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  84  |     expect(dbStudent.fee_paid_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  85  |   });
  86  | 
  87  |   test('Test 3: Cross-Bus Color Logic', async ({ page }) => {
  88  |     await page.goto('/driver');
  89  |     
  90  |     // Login with wrong bus (Bus 2) PIN
  91  |     await page.locator('select').selectOption('Bus 2');
  92  |     await page.fill('input[type="password"]', '0002');
  93  |     await page.click('button[type="submit"]');
  94  | 
  95  |     // Enter Student ID manually
  96  |     await page.click('button:has-text("Manual Entry")');
  97  |     const manualModal = page.locator('.fixed.inset-0', { hasText: 'Manual Entry' });
  98  |     await manualModal.locator('input[type="text"]').fill(TEST_STUDENT_ID);
  99  |     await manualModal.locator('button:has-text("Submit")').click();
  100 | 
  101 |     // Verify Blue Card
  102 |     const blueCard = page.locator('.bg-blue-500'); 
  103 |     await expect(blueCard).toBeVisible();
  104 |     await expect(blueCard).toContainText('Regular Bus: Bus 1');
  105 |     await expect(blueCard).toContainText('Boarding Today: Bus 2');
  106 | 
  107 |     // Next Student & Logout
  108 |     await page.click('button:has-text("Next Student")');
  109 |     await page.click('button:has-text("Logout")');
  110 | 
  111 |     // Login with correct bus (Bus 1) PIN
  112 |     await page.locator('select').selectOption('Bus 1');
  113 |     await page.fill('input[type="password"]', '0001');
  114 |     await page.click('button[type="submit"]');
  115 | 
  116 |     // Enter Student ID manually
  117 |     await page.click('button:has-text("Manual Entry")');
  118 |     await page.locator('.fixed.inset-0', { hasText: 'Manual Entry' }).locator('input[type="text"]').fill(TEST_STUDENT_ID);
  119 |     await page.locator('.fixed.inset-0', { hasText: 'Manual Entry' }).locator('button:has-text("Submit")').click();
  120 | 
  121 |     // Verify Red Card (Since fee was reset to empty due to beforeEach)
  122 |     const redCard = page.locator('.bg-due'); // 'bg-due' is the class in the app
  123 |     await expect(redCard).toBeVisible();
  124 |     await expect(redCard).toContainText('FEE DUE');
  125 |   });
  126 | });
  127 | 
```