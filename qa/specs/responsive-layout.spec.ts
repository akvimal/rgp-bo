/**
 * Small screens - RL-1..3
 * The layout has to work on a laptop with a small screen and on a tablet: no sideways scrolling of the page on the screens people work in,
 * the customer form lays out its four main fields in one row on a laptop, and the menu rail leaves room for the page.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const SIZES = [
  { name: 'laptop 1366x768', width: 1366, height: 768 },
  { name: 'small laptop 1024x768', width: 1024, height: 768 },
  { name: 'tablet 768x1024', width: 768, height: 1024 },
];

const COUNTER_PAGES = ['/secure/sales/pos/new', '/secure/customers/cust/list', '/secure/customers/cust/new', '/secure/inquiries', '/secure/expenses', '/secure/stock-audits'];
const MANAGER_PAGES = ['/secure/hr/staff', '/secure/hr/payroll', '/secure/hr/bonus', '/secure/hr/setup', '/secure/purchases', '/secure/finance', '/secure/vendor-issues', '/secure/products'];

async function sideways(page: any): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('Small screens', () => {
  for (const size of SIZES) {
    test(`RL-1 the counter screens do not scroll sideways on a ${size.name}`, async ({ app }) => {
      const s = await app.open(COUNTER, COUNTER_PAGES[0]);
      await s.page.setViewportSize({ width: size.width, height: size.height });
      for (const path of COUNTER_PAGES) {
        await s.page.goto(path);
        await s.page.waitForLoadState('networkidle');
        expect(await sideways(s.page), `${path} at ${size.name}`).toBeLessThanOrEqual(2);
      }
    });

    test(`RL-2 the manager screens do not scroll sideways on a ${size.name}`, async ({ app }) => {
      const s = await app.open(MGR, MANAGER_PAGES[0]);
      await s.page.setViewportSize({ width: size.width, height: size.height });
      for (const path of MANAGER_PAGES) {
        await s.page.goto(path);
        await s.page.waitForLoadState('networkidle');
        expect(await sideways(s.page), `${path} at ${size.name}`).toBeLessThanOrEqual(2);
      }
    });
  }

  test('RL-3 the customer form has name, mobile, alternate number and email in one row on a small laptop, and stacks on a tablet', async ({ app }) => {
    const s = await app.open(COUNTER, '/secure/customers/cust/new');
    const tops = async () => s.page.evaluate(() => ['cust-f-name', 'cust-f-mobile', 'cust-f-altmobile', 'cust-f-email']
      .map((t) => Math.round(document.querySelector(`[data-testid="${t}"]`)!.getBoundingClientRect().top)));
    await s.page.setViewportSize({ width: 1024, height: 768 });
    await expect(s.page.getByTestId('cust-f-name')).toBeVisible();
    expect(new Set(await tops()).size).toBe(1);
    await s.page.setViewportSize({ width: 768, height: 1024 });
    expect(new Set(await tops()).size).toBeGreaterThan(1);
  });
});
