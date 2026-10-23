/**
 * The new-sale form - POSF-1..6
 * One place to say who is serving, a product list that opens over the page and takes Enter, a Units column that keeps
 * "left" on one line, a bill that adds up (round-off shown), two plainly named choices, and no empty row of tabs.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

async function sellable(api: any) {
  // the counter's own view of the stock: the list on the bill only offers what its store has
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body;
  return rows.filter((x: any) => x.status === 'VERIFIED' && Number(x.sale_price) > 0 && Number(x.balance) >= 5 && x.exp_date);
}

async function freshSalesUser(api: any) {
  const stores = (await api.request('GET', '/stores', undefined, MGR)).body;
  const email = `qa.pos.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  const r = await api.request('POST', '/users', { fullname: 'QA POS User', email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid: 2, storeids: [stores[0].id] }, MGR);
  expect(r.status).toBeLessThan(300);
  return email;
}

test.describe('New sale form @p1', () => {
  test('POSF-1 who is serving is chosen in one place, and the box shows the person chosen @happy', async ({ app }) => {
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    const select = page.getByTestId('sale-operator');
    await expect(select).toBeVisible();
    await expect(select).not.toHaveValue('');                                                  // a person is shown, not "Select"
    expect(await select.evaluate((s: HTMLSelectElement) => s.selectedOptions[0].textContent!.trim())).not.toMatch(/^Select/);
    await expect(page.getByTestId('sale-bill-bar')).not.toContainText('Staff');                // no second, different answer on the bill
  });

  test('POSF-2 typing a product and pressing Enter takes the top match and moves to its units @happy', async ({ app, api }) => {
    const line = (await sellable(api))[0];
    test.skip(!line, 'no sellable stock');
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    const search = page.locator('[data-testid=sale-add-item] input').first();
    await search.fill(String(line.title).slice(0, 4));
    await expect(page.locator('.p-autocomplete-panel li').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('sale-line')).toHaveCount(1);
    await expect(page.getByTestId('sale-line').first().locator('input[aria-label="Units"]')).toBeFocused();
  });

  test('POSF-3 each row of the list shows the product, its price, its batch and what is in stock; one batch is marked to sell first @happy', async ({ app, api }) => {
    const rows = await sellable(api);
    const byProduct = new Map<number, any[]>();
    rows.forEach((r: any) => byProduct.set(r.id, [...(byProduct.get(r.id) || []), r]));
    const multi = [...byProduct.values()].find((l) => l.length > 1);
    test.skip(!multi, 'no product with two batches in stock');
    const title = String(multi![0].title);
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.locator('[data-testid=sale-add-item] input').first().fill(title.slice(0, Math.min(title.length, 12)));
    const mine = page.getByTestId('stock-option').filter({ hasText: title });
    await expect(mine.first()).toBeVisible();
    expect(await mine.count()).toBeGreaterThan(1);
    await expect(mine.first()).not.toContainText('in stock');                                       // stock is not spelled out; only an icon marks none
    await expect(mine.first()).toContainText('₹');
    await expect(mine.locator('.badge', { hasText: 'sell first' })).toHaveCount(1);                 // one batch, the earliest to expire
    const first = (multi as any[]).map((r) => String(r.exp_date).slice(0, 10)).sort()[0];
    const marked = await mine.filter({ has: page.locator('.badge') }).first().innerText();
    expect(marked).toContain(new Date(first + 'T00:00:00Z').toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }));
  });

  test('POSF-4 "left" stays on the same line as the units box, and the lines add up to the total with the round-off shown @edge', async ({ app, api }) => {
    const rows = await sellable(api);
    test.skip(rows.length < 3, 'no sellable stock');
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.setViewportSize({ width: 1366, height: 768 });
    const search = page.locator('[data-testid=sale-add-item] input').first();
    const picked = new Set<number>();
    for (const r of rows) {
      if (picked.size === 3 || picked.has(r.id)) continue;
      picked.add(r.id);
      const answered = page.waitForResponse((res) => res.url().includes('/stock/filter'));
      await search.fill(String(r.title));
      await answered;                                                                               // the list for this text, not the last one
      await expect(page.locator('.p-autocomplete-panel li').first()).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('sale-line')).toHaveCount(picked.size);
      await expect(page.getByTestId('sale-line').nth(picked.size - 1).locator('input[aria-label="Units"]')).toBeFocused();
      await page.keyboard.press('Tab');                                                             // back to the search for the next product
    }
    const heights = await page.getByTestId('sale-line').evaluateAll((trs) => trs.map((tr) => tr.getBoundingClientRect().height));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);                               // no row taller than the others
    const boxes = await page.getByTestId('sale-line').locator('input[aria-label="Units"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(boxes).size).toBe(1);                                                              // every Units box starts at the same place, whatever its "left" says
    const left = page.getByTestId('sale-line').first().locator('span', { hasText: 'left' }).first();
    expect((await left.boundingBox())!.height).toBeLessThan(24);                                       // "951 left" is one line

    const amounts = await page.getByTestId('sale-line').evaluateAll((trs) => trs.map((tr) => Number((tr.lastElementChild as HTMLElement).innerText.replace(/[^0-9.\-]/g, ''))));
    const lines = amounts.reduce((a, b) => a + b, 0);
    const total = Number((await page.getByTestId('sale-total').innerText()).replace(/[^0-9.\-]/g, ''));
    const note = page.getByTestId('sale-roundoff');
    const off = (await note.count()) ? Number(((await note.innerText()).match(/round off\s*(-?[0-9.,]+)/) || [])[1]?.replace(/,/g, '')) : 0;
    expect(Math.abs(lines + off - total)).toBeLessThan(0.06);                                         // what is shown adds up
    for (const tr of await page.getByTestId('sale-line').all()) expect(await tr.locator('td').last().innerText()).toMatch(/\.\d\d$/);   // amounts always show paise
    const barBoxes = await page.getByTestId('sale-bill-bar').locator('input, select, button').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })));
    for (let i = 0; i < barBoxes.length; i++) for (let j = i + 1; j < barBoxes.length; j++) {
      const a = barBoxes[i], b = barBoxes[j];
      expect(a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1).toBe(false);          // nothing in the bill bar sits on top of anything else
    }
  });

  test('POSF-5 how the order came and how it is handed over are named, and the choice shows @happy', async ({ app }) => {
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.setViewportSize({ width: 1366, height: 768 });
    const bar = page.getByTestId('sale-bill-bar');
    await expect(bar).toContainText('Order came by');
    await expect(bar).not.toContainText('Date');                                                      // today's date is not something to read off the bill bar
    await expect(bar).toContainText('Handed over');
    await expect(page.getByTestId('sale-deliverytype-counter')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('sale-deliverytype-delivery').click();
    await expect(page.getByTestId('sale-deliverytype-delivery')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('sale-deliverytype-counter')).toHaveAttribute('aria-pressed', 'false');
    const top = await Promise.all(['sale-ordertype', 'sale-deliverytype'].map(async (id) => (await page.getByTestId(id).boundingBox())!.y));
    expect(Math.abs(top[0] - top[1])).toBeLessThan(12);                                                // on one line at 1366 wide
  });

  test('POSF-6 the row of tabs shows only when there is something to switch to @edge', async ({ app, api }) => {
    const email = await freshSalesUser(api);
    const saved = (await api.request('GET', '/sales/saved', undefined, email)).body as any[];
    const { page } = await app.open(email, '/secure/sales/pos/new');
    await expect(page.getByTestId('sale-bill-bar')).toBeVisible();
    await expect(page.getByTestId('sale-tabs')).toHaveCount(saved.length > 0 ? 1 : 0);   // nothing saved: the blank bill is all there is
  });

  test('POSF-8 the product box is as wide as the Product column, and its list opens wide enough to read @happy', async ({ app, api }) => {
    const line = (await sellable(api))[0];
    test.skip(!line, 'no sellable stock');
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.locator('[data-testid=sale-add-item] input').first()).toBeVisible();
    const box = (await page.locator('[data-testid=sale-add-item] input').first().boundingBox())!;
    const head = (await page.locator('table:has([data-testid=sale-add-item]) thead th').nth(1).boundingBox())!;
    expect(Math.abs(box.width - head.width)).toBeLessThan(40);                                      // the Product column, not the whole row
    expect(box.width).toBeLessThan(700);
    await page.locator('[data-testid=sale-add-item] input').first().fill(String(line.title).slice(0, 4));
    const panel = page.locator('.stock-select-panel');
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.width).toBeGreaterThan(520);
  });

  test('POSF-7 the empty mobile box asks for the number and says why @happy', async ({ app }) => {
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    const hint = page.getByTestId('sale-mobile-hint');
    await expect(hint).toContainText('Ask for their mobile number');
    await expect(hint).toContainText('chronic');
    await expect(hint).not.toContainText('walk-in');
  });
});
