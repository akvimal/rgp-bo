/**
 * Dialogs follow one size scale - DG-UI-1..2
 * Every dialog is one of four widths (30, 36, 48, 64rem), never wider than the screen, and not draggable. The old 32rem "Approval for payment" dialog
 * is now the 30rem small size; on a phone it fits the screen. (docs/planning/UI_PATTERNS.md section 3)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const REM = 16;

test('DG-UI-1 a dialog opens at one of the four standard widths', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/purchases/invoices/list');
  await page.getByTestId('inv-rule-open').click();
  const box = await page.locator('.p-dialog').first().boundingBox();
  expect(box).not.toBeNull();
  const widths = [30, 36, 48, 64].map((r) => r * REM);
  expect(widths.some((w) => Math.abs(box!.width - w) <= 2), `dialog width ${box!.width}px is one of ${widths.join(', ')}`).toBe(true);
});

test('DG-UI-2 on a phone a dialog fits the screen', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/purchases/invoices/list');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByTestId('inv-rule-open').click();
  const box = await page.locator('.p-dialog').first().boundingBox();
  expect(box!.width).toBeLessThanOrEqual(360);
});
