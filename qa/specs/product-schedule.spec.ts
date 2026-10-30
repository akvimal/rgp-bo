/**
 * The schedule of a medicine says what it requires - SCH-1
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

test('SCH-1 choosing the Medicine category lists each schedule with what it requires', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/products/master/new');
  await page.locator('#category').selectOption('Medicine');
  const options = (await page.locator('label:has-text("Schedule") ~ select option').allTextContents()).map((t) => t.trim());
  expect(options).toContain('Schedule H: Prescription required');
  expect(options).toContain('Schedule H1: Prescription + mandatory H1 register');
  expect(options).toContain('Schedule X: Special licence + prescription + locked inventory');
  expect(options).toContain('Other');
});
