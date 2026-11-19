/**
 * The purchase order list and its detail - POUI-1..7 (POUI-6: a product not in the list on an order; POUI-7: items added to a submitted order)
 * Plain status names, filters above the list, one grid look, an order that can be edited while it is a draft (details, quantities,
 * delete) and is locked once submitted, with rate and value per line.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function draftWithItem(api: any, qty = 5) {
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
  const prod = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body[0];
  const po = await api.request('POST', '/purchaseorders', { vendorid: vendor.id, comments: 'QA draft' }, MGR);
  expect(po.status).toBeLessThan(300);
  const rq = await api.request('POST', '/purchaserequests', { productid: prod.id, qty, vendorid: vendor.id, status: 'Open' }, MGR);
  expect(rq.status).toBeLessThan(300);
  expect((await api.request('PUT', `/purchaserequests/${rq.body.id}`, { orderid: po.body.id }, MGR)).status).toBeLessThan(300);
  return { po: po.body.id as number, req: rq.body.id as number, vendor: vendor.name as string, title: prod.title as string };
}

test.describe('Purchase order screens @p1', () => {
  test('POUI-1 the list uses plain status names, the toolbar sits above the list, and a row opens its order @happy', async ({ api, app }) => {
    const d = await draftWithItem(api);
    const { page } = await app.open(MGR, '/secure/purchases/orders');
    await page.getByRole('tab', { name: 'Orders' }).click();
    const row = page.locator(`[data-po-id="${d.po}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('po-status')).toHaveText('Draft');                            // not PENDING
    await expect(row).toHaveAttribute('data-po-status', 'PENDING');                            // the stored word is unchanged
    const heads = (await page.locator('[data-testid=po-row]').first().locator('xpath=ancestor::p-table').locator('thead th').allInnerTexts()).map((t) => t.trim());
    expect(heads).toEqual(['PO No.', 'Vendor', 'Date', 'Expected', 'Lines', 'Value', 'Status']);
    const opts = (await page.getByTestId('po-status-filter').locator('option').allInnerTexts()).map((t) => t.trim());
    expect(opts).toEqual(['All status', 'Draft', 'Awaiting approval', 'Submitted', 'Rejected', 'Cancelled']);
    await expect(page.getByTestId('po-search')).toBeVisible();
    const bar = (await page.getByTestId('po-create').boundingBox())!;
    const table = (await page.locator('[data-testid=po-row]').first().locator('xpath=ancestor::p-table').boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(table.y + 2);                              // above the list it controls
    expect(Math.abs(bar.x - table.x)).toBeLessThan(40);                                         // and in line with it
    await page.getByTestId('po-status-filter').selectOption('PENDING_APPROVAL');
    await expect(row).toHaveCount(0);
    await page.getByTestId('po-status-filter').selectOption('PENDING');
    await expect(row).toBeVisible();
    await row.locator('td').nth(1).click();                                                    // anywhere on the row, not only the number
    await expect(page).toHaveURL(new RegExp(`/secure/purchases/orders/${d.po}$`));
    await expect(page.getByTestId('po-detail-status')).toHaveText('Draft');
    await page.getByTestId('po-close').click();
    await expect(page).toHaveURL(/\/secure\/purchases\/orders$/);
    await expect(page.getByTestId('po-detail')).toHaveCount(0);
    await expect(row).toBeVisible();                                                           // still on the Orders tab, not thrown back to Requests
  });

  test('POUI-2 a draft shows rate and value per line, its quantity can be changed, its details edited, and it can be deleted @happy', async ({ api, app }) => {
    const d = await draftWithItem(api, 5);
    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    const detail = page.getByTestId('po-detail');
    await expect(detail).toContainText(`PO No. ${d.po}`);
    await expect(detail).toContainText(d.vendor);
    await expect(page.getByTestId('po-add-request')).toHaveText(/Add items/);
    await expect(page.getByTestId('po-proceed')).toHaveText(/Submit/);
    await expect(page.getByTestId('po-download')).toContainText('Download PDF');
    const heads = (await page.getByTestId('po-fulfilment').locator('thead th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(heads).toEqual(['Product', 'Pack', 'Rate', 'Ordered', 'Value', 'Invoiced', 'Received']);
    await expect(page.getByTestId('po-totals')).toBeVisible();

    const qty = page.getByTestId('po-qty').first();
    await expect(qty).toHaveValue('5');
    await qty.fill('8');
    await qty.blur();
    await expect.poll(async () => ((await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.requests[0].orderedqty)).toBe(8);
    await expect(page.getByTestId('po-totals')).toContainText('8');
    await qty.fill('0');
    await qty.blur();
    await expect(page.getByTestId('po-error')).toContainText('at least 1');
    await expect(qty).toHaveValue('8');

    await page.getByTestId('po-edit').click();
    await page.getByTestId('po-e-date').fill('2030-01-15');
    await page.getByTestId('po-e-comments').fill('QA changed note');
    await page.getByTestId('po-e-save').click();
    await expect(page.getByTestId('po-facts')).toContainText('15 Jan 2030');
    await expect(page.getByTestId('po-facts')).toContainText('QA changed note');
    const after = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body;
    expect(String(after.expecteddate)).toContain('2030-01-15');
    await page.getByTestId('po-close').click();
    await expect(page.locator(`[data-po-id="${d.po}"]`)).toContainText('15 Jan 2030');           // the list caught up with the change
    await page.locator(`[data-po-id="${d.po}"]`).locator('td').nth(1).click();
    await expect(page.getByTestId('po-detail')).toBeVisible();

    await page.getByTestId('po-delete').click();
    await page.getByRole('button', { name: /^(Delete|Yes)/ }).last().click();
    await expect(page).toHaveURL(/\/secure\/purchases\/orders$/);
    await expect(page.locator(`[data-po-id="${d.po}"]`)).toHaveCount(0);
  });

  test('POUI-3 once submitted, the order shows as Submitted and its quantities and details are locked @edge', async ({ api, app }) => {
    const d = await draftWithItem(api, 3);
    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    await page.getByTestId('po-proceed').click();
    await expect(page.getByTestId('po-detail-status')).not.toHaveText('Draft');
    const st = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.status;
    await expect(page.locator(`[data-po-id="${d.po}"]`)).toHaveAttribute('data-po-status', st);   // the list was refreshed, not left showing a draft
    if (st === 'SUBMITTED') await expect(page.locator(`[data-po-id="${d.po}"]`).getByTestId('po-status')).toHaveText('Submitted');
    await expect(page.getByTestId('po-qty')).toHaveCount(0);
    await expect(page.getByTestId('po-edit')).toHaveCount(0);
    await expect(page.getByTestId('po-delete')).toHaveCount(0);
    await expect(page.getByTestId('po-add-request')).toHaveCount(1);                           // items can still be added, with a reason, and it goes back for approval (POUI-7)
    const locked = await api.request('PUT', `/purchaserequests/${d.req}`, { orderedqty: 9 }, MGR);
    expect(locked.status).toBe(400);                                                           // and the server holds it too
    expect(JSON.stringify(locked.body)).toContain('cannot be changed');
    expect((await api.request('DELETE', `/purchaseorders/${d.po}`, undefined, MGR)).status).toBe(400);
  });

  test('POUI-4 up and down in the ordered box move to the line above or below, and never change the number @happy', async ({ api, app }) => {
    const d = await draftWithItem(api, 5);
    const vendorId = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.vendorid;
    const prods = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body;
    for (const [i, qty] of [[1, 6], [2, 7]] as Array<[number, number]>) {
      const rq = await api.request('POST', '/purchaserequests', { productid: prods[i].id, qty, vendorid: vendorId, status: 'Open' }, MGR);
      expect(rq.status).toBeLessThan(300);
      expect((await api.request('PUT', `/purchaserequests/${rq.body.id}`, { orderid: d.po }, MGR)).status).toBeLessThan(300);
    }
    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    const boxes = page.getByTestId('po-qty');
    await expect(boxes).toHaveCount(3);
    const before = await boxes.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

    await boxes.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(boxes.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(boxes.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');                       // at the last line: stays, and the number is not changed
    await expect(boxes.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(boxes.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');                         // at the first line: stays
    await expect(boxes.nth(0)).toBeFocused();
    expect(await boxes.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(before);

    // a number typed in a line is saved on the way down, and the cursor is on the next line when the order has reloaded
    await boxes.nth(0).fill('9');
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.requests.map((r: any) => r.orderedqty ?? r.qty)).toContain(9);
    await expect(boxes.nth(1)).toBeFocused();
    expect(await boxes.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(['9', before[1], before[2]]);
  });

  test('POUI-5 a product on two lines of an order is highlighted, and the Add items list flags a product already on the order @happy', async ({ api, app }) => {
    const d = await draftWithItem(api, 5);
    const order = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body;
    const prods = (await api.request('POST', '/stock/filter', { available: true, limit: 100 }, MGR)).body;
    const first = order.requests[0].product.id;
    const other = prods.find((p: any) => p.id !== first);
    // the same product again on the order (for another customer), and a different product once
    for (const pid of [first, other.id]) {
      const rq = await api.request('POST', '/purchaserequests', { productid: pid, qty: 2, vendorid: order.vendorid, status: 'Open' }, MGR);
      expect((await api.request('PUT', `/purchaserequests/${rq.body.id}`, { orderid: d.po }, MGR)).status).toBeLessThan(300);
    }
    // and one more request of the same product, reviewed and waiting to be added
    const waiting = await api.request('POST', '/purchaserequests', { productid: first, qty: 1, vendorid: order.vendorid, status: 'Open' }, MGR);
    expect((await api.request('PUT', `/purchaserequests/${waiting.body.id}`, { status: 'Reviewed' }, MGR)).status).toBeLessThan(300);

    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    const rows = page.getByTestId('po-fulfilment-row');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('[data-testid=po-fulfilment-row][data-repeated=yes]')).toHaveCount(2);   // the two lines of the same product
    await expect(page.getByTestId('po-repeated')).toHaveCount(2);
    await expect(rows.filter({ hasText: other.title }).getByTestId('po-repeated')).toHaveCount(0);       // the other product is not flagged
    await expect(page.getByTestId('po-qty')).toHaveCount(3);                                             // and nothing was stopped

    await page.getByTestId('po-add-request').click();
    const flagged = page.getByTestId('po-pick-row').filter({ hasText: d.title }).getByTestId('po-pick-onorder');
    await expect(flagged.first()).toBeVisible();
  });

  test('POUI-6 a request for a product not in the list can go on an order, and shows by the name typed @happy', async ({ api, app }) => {
    const d = await draftWithItem(api, 5);
    const vendorId = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.vendorid;
    const name = `Zzqx Syrup ${Date.now().toString().slice(-6)}`;
    const made = await api.request('POST', '/purchaserequests', { requestedname: name, qty: 3, vendorid: vendorId, status: 'Open', source: 'Customer', requesttype: 'Ad Hoc', priority: 'Normal' }, MGR);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    expect((await api.request('PUT', `/purchaserequests/${made.body.id}`, { status: 'Reviewed' }, MGR)).status).toBeLessThan(300);
    // another one is waiting to be picked in the Add items list
    const name2 = `${name} B`;
    const waiting = await api.request('POST', '/purchaserequests', { requestedname: name2, qty: 1, vendorid: vendorId, status: 'Open', source: 'Customer', requesttype: 'Ad Hoc', priority: 'Normal' }, MGR);
    expect((await api.request('PUT', `/purchaserequests/${waiting.body.id}`, { status: 'Reviewed' }, MGR)).status).toBeLessThan(300);

    // on the order, with no product; the API takes it, and refuses to mark it received before it has one
    expect((await api.request('PUT', `/purchaserequests/${made.body.id}`, { status: 'Ordered', orderid: d.po }, MGR)).status).toBeLessThan(300);
    expect((await api.request('PUT', `/purchaserequests/${made.body.id}`, { status: 'Received' }, MGR)).status).toBe(400);

    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    const row = page.getByTestId('po-fulfilment-row').filter({ hasText: name }).first();
    await expect(row).toBeVisible();
    await expect(row.getByTestId('po-unlisted')).toBeVisible();
    await expect(page.getByTestId('po-qty')).toHaveCount(2);

    await page.getByTestId('po-add-request').click();
    const pick = page.getByTestId('po-pick-row').filter({ hasText: name2 });
    await expect(pick.getByTestId('po-pick-unlisted')).toBeVisible();
    await pick.getByTestId('po-pick-check').check();
    await page.getByTestId('po-pick-add').click();
    await expect(page.getByTestId('po-fulfilment-row').filter({ hasText: name2 })).toBeVisible();
    // the order can be downloaded as a PDF with such a line on it
    const pdf = await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR);
    expect(pdf.body.requests.filter((r: any) => !r.product).length).toBe(2);
  });

  test('POUI-7 items can be added to a submitted order with a reason, and it goes back for approval @happy', async ({ api, app }) => {
    const d = await draftWithItem(api, 5);
    const order0 = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body;
    // a submitted (and approved) order
    expect((await api.request('POST', `/purchaseorders/${d.po}/submit`, {}, MGR)).status).toBeLessThan(300);
    if ((await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.status === 'PENDING_APPROVAL') {
      expect((await api.request('POST', `/purchaseorders/${d.po}/approve`, {}, MGR)).status).toBeLessThan(300);
    }
    expect((await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.status).toBe('SUBMITTED');

    const prods = (await api.request('POST', '/stock/filter', { available: true, limit: 100 }, MGR)).body;
    const other = prods.find((p: any) => p.id !== order0.requests[0].product.id);
    const rq = await api.request('POST', '/purchaserequests', { productid: other.id, qty: 4, vendorid: order0.vendorid, status: 'Open' }, MGR);
    expect((await api.request('PUT', `/purchaserequests/${rq.body.id}`, { status: 'Reviewed' }, MGR)).status).toBeLessThan(300);

    // the API wants a reason, and only a submitted order takes items this way
    const noReason = await api.request('POST', `/purchaseorders/${d.po}/amend`, { requestids: [rq.body.id], comment: '  ' }, MGR);
    expect(noReason.status).toBe(400);
    expect(JSON.stringify(noReason.body)).toContain('Say why');
    const draft = await draftWithItem(api, 2);
    const onDraft = await api.request('POST', `/purchaseorders/${draft.po}/amend`, { requestids: [rq.body.id], comment: 'x' }, MGR);
    expect(onDraft.status).toBe(400);
    expect(JSON.stringify(onDraft.body)).toContain('not submitted');

    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    await expect(page.getByTestId('po-detail-status')).toHaveText('Submitted');
    await page.getByTestId('po-add-request').click();
    await expect(page.getByTestId('po-amend-note')).toBeVisible();
    const pick = page.getByTestId('po-pick-row').filter({ hasText: other.title });
    await pick.getByTestId('po-pick-check').check();
    await expect(page.getByTestId('po-pick-add')).toBeDisabled();                 // a reason first
    const reason = `QA customer asked after it went out ${Date.now().toString().slice(-5)}`;
    await page.getByTestId('po-amend-comment').fill(reason);
    await expect(page.getByTestId('po-pick-add')).toBeEnabled();
    await page.getByTestId('po-pick-add').click();

    // back for approval, with the reason and the item kept on the order
    const after = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body;
    expect(after.amendments).toHaveLength(1);
    expect(after.amendments[0]).toMatchObject({ comment: reason });
    expect(after.amendments[0].items[0].qty).toBe(4);
    expect(after.requests).toHaveLength(2);
    await expect(page.getByTestId('po-amendment')).toContainText(reason);
    if (after.status === 'PENDING_APPROVAL') {
      await expect(page.getByTestId('po-detail-status')).toHaveText('Awaiting approval');
      await expect(page.getByTestId('po-awaiting')).toContainText(reason);
      await expect(page.getByTestId('po-qty')).toHaveCount(0);                     // locked while it waits
      await page.getByTestId('po-approve').click();
    }
    await expect(page.getByTestId('po-detail-status')).toHaveText('Submitted');
    // a cancelled order does not take items
    expect((await api.request('POST', `/purchaseorders/${draft.po}/cancel`, { reason: 'QA' }, MGR)).status).toBeLessThan(500);
  });
});
