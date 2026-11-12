/**
 * Quick price pick — QUICK-1..2
 * Source: docs/planning/PRICE_QUICK_PICK.md
 *
 * The price dialog offers the MRP and each step off it (a global step), greys the steps below the lowest price the product's class allows, and a choice only
 * fills the price box. The step and the number of steps are set with the pricing mode.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

// the pricing mode is one setting for the whole business: these tests change it, so they run one after another
test.describe.configure({ mode: 'serial' });

const getMode = async (api: any) => (await api.request('GET', '/pricing/mode', undefined, MGR)).body.settings;
const putMode = (api: any, body: any) => api.request('PUT', '/pricing/mode', body, MGR);

async function boughtProduct(api: any, ptr: number, mrp: number) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA QUICK ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `QK${stamp}` }, MGR);
  expect(prod.status).toBeLessThan(300);
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
  const inv = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA-QUICK-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 5, ptrvalue: ptr, ptrcost: ptr, mrpcost: mrp,
    taxpcnt: 12, total: +(5 * ptr * 1.12).toFixed(2), batch: `QK-${stamp}`, expdate: '2028-06-30', saleprice: mrp,
  }, MGR);
  expect(it.status).toBeLessThan(300);
  // the pricing policy judges a price against completed purchases only
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  return { id: prod.body.id as number, title: prod.body.title as string };
}

test.describe('Quick price pick @p1', () => {
  test('QUICK-1 the step and the number of choices are settings, checked and kept @happy', async ({ api }) => {
    const original = await getMode(api);
    expect(original).toMatchObject({ quickStepPct: 5, quickMaxChoices: 4 });
    try {
      expect((await putMode(api, { quickStepPct: 0.1 })).status).toBeGreaterThanOrEqual(400);       // under 0.5
      expect((await putMode(api, { quickMaxChoices: 0 })).status).toBeGreaterThanOrEqual(400);
      expect((await putMode(api, { quickMaxChoices: 2.5 })).status).toBeGreaterThanOrEqual(400);
      const ok = await putMode(api, { quickStepPct: 2.5, quickMaxChoices: 6 });
      expect(ok.status).toBeLessThan(300);
      expect(await getMode(api)).toMatchObject({ quickStepPct: 2.5, quickMaxChoices: 6, mode: original.mode, basis: original.basis });
    } finally {
      await putMode(api, { quickStepPct: original.quickStepPct, quickMaxChoices: original.quickMaxChoices });
    }
  });

  test('QUICK-2 the dialog offers the MRP and the steps, greys the ones under the lowest price, and a choice fills the price box @happy', async ({ app, api }) => {
    const original = await getMode(api);
    const p = await boughtProduct(api, 100, 200);
    try {
      expect((await putMode(api, { quickStepPct: 40, quickMaxChoices: 3 })).status).toBeLessThan(300);      // 0, 40, 80 and 120% (120 is not offered: past 100)
      const { page } = await app.open(MGR, '/secure/products/price');
      await page.getByPlaceholder('Product').fill(p.title);
      const row = page.locator('tbody tr', { hasText: p.title });
      await expect(row).toHaveCount(1);
      await row.getByTestId('price-edit').click();

      const quick = page.getByTestId('price-quick');
      await expect(quick).toBeVisible();
      await expect(page.getByTestId('price-quick-0')).toBeEnabled();                              // the MRP itself
      await expect(page.getByTestId('price-quick-80')).toBeDisabled();                           // 80% off is under any class's lowest price

      await page.getByTestId('price-quick-0').click();
      const shown = (await page.getByTestId('price-quick-0').locator('b').innerText()).replace(/,/g, '');
      await expect(page.getByTestId('price-dialog-price')).toHaveValue(String(+shown));          // filled, not saved
      await expect(page.getByTestId('price-quick-0')).toHaveClass(/btn-primary/);
      await page.getByTestId('price-dialog-price').fill('150');
      await expect(page.getByTestId('price-quick-0')).not.toHaveClass(/btn-primary/);            // typing clears the highlight
    } finally {
      await putMode(api, { quickStepPct: original.quickStepPct, quickMaxChoices: original.quickMaxChoices });
    }
  });
});
