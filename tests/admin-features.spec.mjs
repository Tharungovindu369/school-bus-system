import { test, expect } from '@playwright/test';
import { updateStudentFeeStatus, updateStudentBusNumber, getStudentById, clearCache, getBusByNumber } from '../server/services/sheets.js';
import { config } from '../server/config.js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly for tests
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

test.describe('Admin & Driver Features', () => {
  const TEST_STUDENT_ID = 'S0001';
  const BASE_BUS = 'Bus 1';

  test.beforeEach(async () => {
    // Reset the test student to a known baseline
    await updateStudentBusNumber(TEST_STUDENT_ID, BASE_BUS);
    await updateStudentFeeStatus(TEST_STUDENT_ID, '');
    clearCache();
  });

  test.afterEach(async () => {
    // Clean up after tests
    await updateStudentBusNumber(TEST_STUDENT_ID, BASE_BUS);
    await updateStudentFeeStatus(TEST_STUDENT_ID, '');
    clearCache();
  });

  test('Test 1: Change Bus Feature', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[type="password"]', config.adminPassword);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Students")');
    await expect(page.locator('table')).toBeVisible();

    await page.fill('input[placeholder*="Search"]', TEST_STUDENT_ID);

    const row = page.locator('tr', { hasText: TEST_STUDENT_ID }).first();
    await expect(row).toBeVisible();

    await row.locator('button', { hasText: 'Change Bus' }).click();

    const modal = page.locator('.fixed.inset-0', { hasText: 'Change Bus' });
    await expect(modal).toBeVisible();
    await modal.locator('select').selectOption('Bus 2');
    await modal.locator('button[type="submit"]').click();

    await expect(page.getByText('Bus updated for student', { exact: false })).toBeVisible();
    await expect(row).toContainText('Bus 2');

    clearCache();
    const dbStudent = await getStudentById(TEST_STUDENT_ID);
    expect(dbStudent.bus_number).toBe('Bus 2');
  });

  test('Test 2: Fee Payment Save', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[type="password"]', config.adminPassword);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Students")');
    await page.fill('input[placeholder*="Search"]', TEST_STUDENT_ID);
    const row = page.locator('tr', { hasText: TEST_STUDENT_ID }).first();
    await expect(row).toBeVisible();

    await row.locator('button', { hasText: 'Update Payment' }).click();

    const modal = page.locator('.fixed.inset-0', { hasText: 'Update Fee Status' });
    await expect(modal).toBeVisible();
    await modal.locator('select').selectOption('3');
    await modal.locator('button:has-text("Save Payment")').click();

    await expect(page.getByText('Fee status updated successfully', { exact: false })).toBeVisible();

    await expect(row.locator('.bg-paid')).toBeVisible();
    await expect(row.locator('.bg-paid')).toContainText('PAID');

    clearCache();
    const dbStudent = await getStudentById(TEST_STUDENT_ID);
    expect(dbStudent.fee_status).toBe('PAID');
    expect(dbStudent.fee_paid_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('Test 3: Cross-Bus Color Logic', async ({ page }) => {
    await page.goto('/driver');
    
    // Login with wrong bus (Bus 2) PIN
    await page.locator('select').selectOption('Bus 2');
    await page.fill('input[type="password"]', '0002');
    await page.click('button[type="submit"]');

    // Enter Student ID manually
    await page.click('button:has-text("Manual Entry")');
    const manualModal = page.locator('.fixed.inset-0', { hasText: 'Manual Entry' });
    await manualModal.locator('input[type="text"]').fill(TEST_STUDENT_ID);
    await manualModal.locator('button:has-text("Submit")').click();

    // Verify Blue Card
    const blueCard = page.locator('.bg-blue-500'); 
    await expect(blueCard).toBeVisible();
    await expect(blueCard).toContainText('Regular Bus: Bus 1');
    await expect(blueCard).toContainText('Boarding Today: Bus 2');

    // Next Student & Logout
    await page.click('button:has-text("Next Student")');
    await page.click('button:has-text("Logout")');

    // Login with correct bus (Bus 1) PIN
    await page.locator('select').selectOption('Bus 1');
    await page.fill('input[type="password"]', '0001');
    await page.click('button[type="submit"]');

    // Enter Student ID manually
    await page.click('button:has-text("Manual Entry")');
    await page.locator('.fixed.inset-0', { hasText: 'Manual Entry' }).locator('input[type="text"]').fill(TEST_STUDENT_ID);
    await page.locator('.fixed.inset-0', { hasText: 'Manual Entry' }).locator('button:has-text("Submit")').click();

    // Verify Red Card (Since fee was reset to empty due to beforeEach)
    const redCard = page.locator('.bg-due'); // 'bg-due' is the class in the app
    await expect(redCard).toBeVisible();
    await expect(redCard).toContainText('FEE DUE');
  });
});
