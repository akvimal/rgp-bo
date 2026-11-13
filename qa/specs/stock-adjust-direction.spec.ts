/**
 * Adjust stock: remove or add - ADJD-1..3
 * The form asks first whether stock is being removed or added, then how many (a positive number), then why: the reasons offered depend on the direction,
 * the effect is shown in words, and the server refuses a reason that contradicts the direction. The Adjustments list says "removed" or "added".
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-6);

/** a fresh product with one verified batch of 50 units (pack 1), on a completed invoice */
async function batch(api: any, tag: string) {
  const v = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-ADJD-${tag}`, invoicedate: '2026-09-04' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA-ADJD-PROD-${tag}`, taxpcnt: 12, category: 'Analgesic', code: `AJD${tag}`, pack: 1 }, MGR);
  const productid = prod.body.id;
  const lineTotal = 50 * 7;
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid, qty: 50, ptrvalue: 7, ptrcost: 7, mrpcost: 10, saleprice: 10, taxpcnt: 12, total: lineTotal, batch: `AJD-${tag}`, expdate: '2028-06-30',
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: Math.round(lineTotal * 1.12) } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  return { itemid: it.body.id as number, productid: productid as number, batch: `AJD-${tag}`, title: `QA-ADJD-PROD-${tag}` };
}
const adjust = (api: any, body: any) => api.request('POST', '/stock/adjust/qty', body, MGR);
const movesOf = async (api: any, itemid: number) => ((await api.request('GET', '/stock/adjust/qty', undefined, MGR)).body as any[]).filter((m) => m.itemid === itemid);

test.describe('Adjust stock: remove or add @p1', () => {
  test('ADJD-1 the server refuses a reason that contradicts the direction, and accepts the new gain reasons @negative', async ({ api }) => {
    const b = await batch(api, `a${run}`);
    const gain = await adjust(api, { itemid: b.itemid, qty: 5, reasoncode: 'DAMAGED', comments: 'qa' });
    expect(gain.status).toBe(400);
    expect(JSON.stringify(gain.body)).toContain('adds stock');
    const loss = await adjust(api, { itemid: b.itemid, qty: -5, reasoncode: 'FOUND', comments: 'qa' });
    expect(loss.status).toBe(400);
    expect(JSON.stringify(loss.body)).toContain('removes stock');
    expect((await movesOf(api, b.itemid)).length, 'nothing was saved').toBe(0);

    for (const [qty, code] of [[3, 'FOUND'], [2, 'NOT_ENTERED'], [1, 'CUSTOMER_RETURN'], [4, 'CORRECTION'], [-1, 'SHRINKAGE'], [-2, 'CORRECTION']] as const) {
      const ok = await adjust(api, { itemid: b.itemid, qty, reasoncode: code, comments: 'qa' });
      expect(ok.status, `${code} ${qty}: ${JSON.stringify(ok.body)}`).toBeLessThan(300);
    }
    // editing a saved loss into a gain that keeps a loss reason is refused too
    const moves = await movesOf(api, b.itemid);
    const shrink = moves.find((m) => m.reasoncode === 'SHRINKAGE');
    const edit = await api.request('PUT', `/stock/adjust/qty/${shrink.id}`, { qty: 4 }, MGR);
    expect(edit.status).toBe(400);
    expect(JSON.stringify(edit.body)).toContain('adds stock');
  });

  test('ADJD-4 a sample, gift or own use takes stock out, needs a note, and shows in the GST adjustments @negative', async ({ api }) => {
    const b = await batch(api, `d${run}`);
    for (const code of ['SAMPLE', 'GIFT', 'OWN_USE']) {
      const noNote = await adjust(api, { itemid: b.itemid, qty: -1, reasoncode: code });
      expect(noNote.status, code).toBe(400);
      expect(JSON.stringify(noNote.body)).toContain('who it went to');
      const gain = await adjust(api, { itemid: b.itemid, qty: 1, reasoncode: code, comments: 'qa' });
      expect(gain.status, code).toBe(400);
      expect(JSON.stringify(gain.body)).toContain('adds stock');
    }
    expect((await movesOf(api, b.itemid)).length, 'nothing was saved').toBe(0);

    const ok = await adjust(api, { itemid: b.itemid, qty: -3, reasoncode: 'SAMPLE', comments: 'Dr Rao clinic, new product sample' });
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.reasoncode).toBe('SAMPLE');
    // editing a saved sample so that its note is blank is refused
    const blank = await api.request('PUT', `/stock/adjust/qty/${ok.body.id}`, { reasoncode: 'GIFT', comments: ' ' }, MGR);
    expect(blank.status).toBe(400);

    if (String(ok.body.status).toUpperCase() === 'APPROVED') {
      const month = new Date().toISOString().slice(0, 7);
      const adj = (await api.request('GET', `/gst/adjustments?month=${month}`, undefined, MGR)).body;
      const row = adj.given_out.rows.find((r: any) => r.source === 'SAMPLE' && r.rate === 12);
      expect(row, JSON.stringify(adj.given_out)).toBeTruthy();
      expect(row.qty).toBeGreaterThanOrEqual(3);
      expect(row.mrp).toBeGreaterThan(row.taxable);                     // MRP 10 against cost 7 a unit
      expect(adj.any).toBe(true);
    }
  });

  test('ADJD-2 the form says remove or add first, shows the effect in words, and saves a signed quantity, with real clicks @happy', async ({ api, app }) => {
    const b = await batch(api, `b${run}`);
    const { page } = await app.open(MGR, `/secure/store/stock/products/items/${b.productid}`);
    await page.locator('tr', { hasText: b.batch }).getByTestId('stk-adjust-open').click();
    const form = page.getByTestId('adj-form');
    await expect(form).toBeVisible();

    // nothing can be saved before saying which
    await expect(form.getByTestId('adj-save')).toBeDisabled();
    await expect(form.getByTestId('adj-save')).toContainText('Choose remove or add');
    await expect(form.getByTestId('adj-qty')).toHaveCount(0);

    // remove: only the loss reasons, the effect in words, an impossible quantity is said
    await form.getByTestId('adj-dir-remove').click();
    const reasons = form.getByTestId('adj-reason');
    await expect(reasons.locator('option', { hasText: 'Found in a count' })).toHaveCount(0);
    await expect(reasons.locator('option', { hasText: 'Damaged' })).toHaveCount(1);
    await expect(reasons.locator('option', { hasText: 'Lost or missing' })).toHaveCount(1);
    await form.getByTestId('adj-qty').fill('999');
    await expect(form.getByTestId('adj-problem')).toContainText('at most 50');
    await expect(form.getByTestId('adj-save')).toBeDisabled();
    await form.getByTestId('adj-qty').fill('5');
    await expect(form.getByTestId('adj-effect')).toContainText('50');
    await expect(form.getByTestId('adj-effect')).toContainText('45');
    await expect(form.getByTestId('adj-effect')).toContainText('removing 5');
    await expect(form.getByTestId('adj-save'), 'a reason is still needed').toBeDisabled();
    await reasons.selectOption('DAMAGED');
    await expect(form.getByTestId('adj-review')).toContainText('removing 5 units');
    await expect(form.getByTestId('adj-review')).toContainText('from 50 to 45');
    await expect(form.getByTestId('adj-save')).toContainText('Remove 5 units');

    // switching to add clears the loss reason, and offers the gain reasons
    await form.getByTestId('adj-dir-add').click();
    await expect(reasons).toHaveValue('');
    await expect(reasons.locator('option', { hasText: 'Found in a count' })).toHaveCount(1);
    await expect(reasons.locator('option', { hasText: 'Damaged' })).toHaveCount(0);
    await expect(form.getByTestId('adj-save')).toBeDisabled();
    await reasons.selectOption('OTHER');
    await expect(form.getByTestId('adj-save'), 'Other needs a few words').toBeDisabled();
    await form.getByTestId('adj-comments').fill('two boxes were behind the shelf');
    await expect(form.getByTestId('adj-save')).toContainText('Add 5 units');
    await expect(form.getByTestId('adj-save')).toBeEnabled();
    await reasons.selectOption('FOUND');
    await form.getByTestId('adj-qty').fill('3');
    await form.getByTestId('adj-save').click();
    await expect(page.getByTestId('adj-form')).toHaveCount(0);
    const added = (await movesOf(api, b.itemid))[0];
    expect(added).toMatchObject({ qty: 3, reasoncode: 'FOUND' });

    // and a removal is saved as a negative number
    await page.reload();
    await page.locator('tr', { hasText: b.batch }).getByTestId('stk-adjust-open').click();
    await page.getByTestId('adj-dir-remove').click();
    await page.getByTestId('adj-qty').fill('4');
    await page.getByTestId('adj-reason').selectOption('SHRINKAGE');
    await page.getByTestId('adj-save').click();
    await expect(page.getByTestId('adj-form')).toHaveCount(0);
    expect((await movesOf(api, b.itemid)).map((m) => m.qty).sort((x, y) => x - y)).toEqual([-4, 3]);
  });

  test('ADJD-3 the Adjustments list says removed or added, in words, with a reason in words @happy', async ({ api, app }) => {
    const b = await batch(api, `c${run}`);
    expect((await adjust(api, { itemid: b.itemid, qty: -6, reasoncode: 'SHRINKAGE', comments: 'qa' })).status).toBeLessThan(300);
    expect((await adjust(api, { itemid: b.itemid, qty: 2, reasoncode: 'FOUND', comments: 'qa' })).status).toBeLessThan(300);
    const { page } = await app.open(MGR, '/secure/store/stock/adjust');
    const rows = page.locator('tr[data-testid="stk-adjust-row"]', { hasText: b.title });
    await expect(rows).toHaveCount(2);
    await expect(rows.getByTestId('adj-removed')).toContainText('6 removed');
    await expect(rows.getByTestId('adj-added')).toContainText('2 added');
    await expect(rows.filter({ has: page.getByTestId('adj-removed') })).toContainText('Lost or missing');
    await expect(rows.filter({ has: page.getByTestId('adj-added') })).toContainText('Found in a count');
  });
});
