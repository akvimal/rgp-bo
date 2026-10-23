/**
 * One look for every list with sort or filter - GRID-1
 * The heading reads from the left; filter then sort sit together at the right edge of the column; and the bill number
 * column is called "Bill No." wherever it appears.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

const PAGES = [
  '/secure/sales/list',
  '/secure/sales/returns',
  '/secure/sales/deliveries',
  '/secure/customers/cust/list',
  '/secure/products/master/list',
  '/secure/products/price',
  '/secure/purchases/vendors/list',
  '/secure/store/stock/products',
  '/secure/store/stock/expiry',
  '/secure/store/stock/adjust',
  '/secure/reports',
];

test.describe('Grid headings @p1', () => {
  for (const url of PAGES) {
    test(`GRID-1 ${url}: headings left, filter then sort at the right edge, "Bill No." named alike @happy`, async ({ app }) => {
      const { page } = await app.open(MGR, url);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForLoadState('networkidle');
      const bars = page.locator('.p-datatable-thead th .th-bar');
      const n = await bars.count();
      test.skip(n === 0, 'no sortable list on this page for this data');
      const problems: string[] = [];
      for (let i = 0; i < n; i++) {
        const bar = bars.nth(i);
        if (!(await bar.isVisible())) continue;
        const label = await bar.locator('.th-label').boundingBox();
        const th = await bar.locator('xpath=ancestor::th').boundingBox();
        if (!label || !th) continue;
        const name = (await bar.locator('.th-label').innerText()).trim();
        if (label.x - th.x > 24) problems.push(`${name}: heading not at the left (${Math.round(label.x - th.x)}px in)`);
        const filter = (await bar.locator('p-columnfilter').count()) ? await bar.locator('p-columnfilter').boundingBox() : null;
        const sort = (await bar.locator('p-sorticon').count()) ? await bar.locator('p-sorticon').boundingBox() : null;
        if (filter && sort && filter.x > sort.x) problems.push(`${name}: sort before filter`);
        const last = sort || filter;
        if (last && th.x + th.width - (last.x + last.width) > 30) problems.push(`${name}: icons not at the right edge`);
        if (/^Bill\s*(#|no\b|number)/i.test(name) && name !== 'Bill No.') problems.push(`${name}: should read "Bill No."`);
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
