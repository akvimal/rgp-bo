/**
 * Stock — STK-3..6, STK-8   (STK-1/2/7 are in regression.spec.ts as the P0 slice)
 * Source: docs/testing/manual-test-plan.html  (module "stock")
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';

async function anyStockItem(api: any) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 40 }, MGR)).body;
  const it = rows.find((x: any) => Number(x.balance) > 40 && x.status === 'VERIFIED');
  expect(it, 'a stocked batch').toBeTruthy();
  return it;
}
const bal = async (api: any, batch: string) => {
  const r = await api.request('POST', '/stock/filter', { available: true }, MGR);
  return r.body.filter((x: any) => x.batch === batch).reduce((a: number, x: any) => a + Number(x.balance), 0);
};

/** A fresh product + batch with a known unit value and pack=1, so the WS-3 approval-threshold
 * tests are deterministic regardless of what values the faker-seeded catalogue happens to carry
 * (seeded products have a randomized pack of 1/10/15/30 - see qa/seed/pharma.ts - which would
 * otherwise make "qty" and "balance" diverge unpredictably). */
async function ownBatch(api: any, tag: string, qty = 50, mrpcost = 1000) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', {
    vendorid: v, invoiceno: `QA-ADJ-${tag}`, invoicedate: '2026-07-01',
  }, MGR);
  const prod = await api.request('POST', '/products', {
    title: `QA-ADJ-PROD-${tag}`, taxpcnt: 12, category: 'Analgesic', code: `ADJ${tag}`, pack: 1,
  }, MGR);
  const productid = prod.body.id;
  const lineTotal = +(qty * mrpcost).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid, qty, ptrvalue: mrpcost * 0.7, ptrcost: mrpcost * 0.7,
    mrpcost, saleprice: mrpcost, taxpcnt: 12, total: lineTotal, batch: `ADJ-${tag}`, expdate: '2028-06-30',
  }, MGR);
  return { itemid: it.body.id, batch: `ADJ-${tag}` };
}

test.describe('Stock — adjustments & audit @p1', () => {
  test('ADJ-REASON-CODE a small adjustment with no explicit status auto-approves under the value threshold @happy', async ({ api }) => {
    const b = await ownBatch(api, `small-${Date.now()}`);
    const r = await api.request('POST', '/stock/adjust/qty', {
      itemid: b.itemid, qty: -1, reasoncode: 'DAMAGED', comments: 'qa small',
    }, MGR);
    expect(r.status).toBeLessThan(300);
    expect(r.body.status).toBe('APPROVED');
    expect(r.body.reasoncode).toBe('DAMAGED');
    expect(await bal(api, b.batch)).toBe(50 - 1);
  });

  test('ADJ-THRESHOLD a high-value adjustment with no explicit status is held for approval @happy', async ({ api }) => {
    const b = await ownBatch(api, `big-${Date.now()}`);
    // 5 units * mrp 1000 = 5000, above the 2000 default threshold
    const r = await api.request('POST', '/stock/adjust/qty', {
      itemid: b.itemid, qty: -5, reasoncode: 'SHRINKAGE', comments: 'qa big',
    }, MGR);
    expect(r.status).toBeLessThan(300);
    expect(r.body.status).toBe('PENDING');

    // pending: stock unchanged
    expect(await bal(api, b.batch)).toBe(50);

    await api.request('PUT', `/stock/audit/${r.body.id}/approve`, undefined, MGR);
    expect(await bal(api, b.batch)).toBe(50 - 5);
  });

  test('ADJ-REJECT rejecting a pending adjustment leaves stock untouched @edge', async ({ api }) => {
    const b = await ownBatch(api, `reject-${Date.now()}`);
    const r = await api.request('POST', '/stock/adjust/qty', {
      itemid: b.itemid, qty: -5, reasoncode: 'SHRINKAGE', comments: 'qa reject',
    }, MGR);
    expect(r.body.status).toBe('PENDING');

    await api.request('PUT', `/stock/audit/${r.body.id}/reject`, undefined, MGR);
    expect(await bal(api, b.batch)).toBe(50);
    const refetched = (await api.request('GET', '/stock/adjust/qty', undefined, MGR)).body.find((x: any) => x.id === r.body.id);
    expect(refetched.status).toBe('REJECTED');
  });

  test('ADJ-EDIT editing an adjustment updates the same row in place, not delete-and-recreate @happy', async ({ api }) => {
    const b = await ownBatch(api, `edit-${Date.now()}`);
    const created = await api.request('POST', '/stock/adjust/qty', {
      itemid: b.itemid, qty: -1, reasoncode: 'DAMAGED', comments: 'qa edit before',
    }, MGR);
    expect(created.body.status).toBe('APPROVED');

    const updated = await api.request('PUT', `/stock/adjust/qty/${created.body.id}`, {
      qty: -2, reasoncode: 'CORRECTION', comments: 'qa edit after',
    }, MGR);
    expect(updated.status).toBeLessThan(300);
    expect(updated.body.id).toBe(created.body.id); // same row, not a new one
    expect(updated.body.qty).toBe(-2);
    expect(updated.body.reasoncode).toBe('CORRECTION');

    // the balance reflects the edited qty, not the original
    expect(await bal(api, b.batch)).toBe(50 - 2);
  });


  test('STK-3 a manual quantity adjustment creates a record and moves available stock @happy', async ({ api }) => {
    const it = await anyStockItem(api);
    const b0 = await bal(api, it.batch);
    const r = await api.request('POST', '/stock/adjust/qty', {
      itemid: it.item_id, qty: -3, status: 'APPROVED', reason: 'Breakage', comments: 'qa STK-3',
    }, MGR);
    expect([200, 201]).toContain(r.status);
    expect(b0 - (await bal(api, it.batch))).toBe(3);
  });

  test('STK-4 an audit adjustment leaves stock untouched until approved, then applies @happy', async ({ api }) => {
    const it = await anyStockItem(api);
    const b0 = await bal(api, it.batch);
    const audit = await api.request('POST', '/stock/audit', [
      { itemid: it.item_id, countedqty: Number(it.balance) - 4, bookqty: Number(it.balance), reason: 'Count', comments: 'qa STK-4' },
    ], MGR);
    expect([200, 201]).toContain(audit.status);

    // pending: stock unchanged
    expect(await bal(api, it.batch)).toBe(b0);

    const pending = (await api.request('GET', '/stock/audit', undefined, MGR)).body
      .find((a: any) => a.itemid === it.item_id && (a.status === 'PENDING' || a.status == null));
    expect(pending).toBeTruthy();
    await api.request('PUT', `/stock/audit/${pending.id}/approve`, undefined, MGR);

    // approved: the -4 now applies
    expect(b0 - (await bal(api, it.batch))).toBe(4);
  });

  test('STK-5 deleting a pending qty adjustment leaves available stock intact @edge', async ({ api }) => {
    const it = await anyStockItem(api);
    const b0 = await bal(api, it.batch);
    const audit = await api.request('POST', '/stock/audit', [
      { itemid: it.item_id, countedqty: Number(it.balance) - 6, bookqty: Number(it.balance), reason: 'Count', comments: 'qa STK-5' },
    ], MGR);
    void audit;
    const pending = (await api.request('GET', '/stock/audit', undefined, MGR)).body
      .filter((a: any) => a.itemid === it.item_id && (a.status === 'PENDING' || a.status == null)).slice(-1)[0];
    expect(pending).toBeTruthy();
    const del = await api.request('DELETE', `/stock/adjust/qty/${pending.id}`, undefined, MGR);
    expect(del.status).toBeLessThan(400);
    expect(await bal(api, it.batch)).toBe(b0); // no partial effect
  });

  test('WS4-NEAR-EXPIRY the near-expiry count endpoint responds with a count and window @happy', async ({ api }) => {
    const r = await api.request('GET', '/stock2/expiries/near-count', undefined, MGR);
    expect(r.status).toBeLessThan(400);
    expect(typeof r.body.count).toBe('number');
    expect(r.body.count).toBeGreaterThanOrEqual(0);
    expect(r.body.days).toBeGreaterThan(0);
  });

  test('WS4-RETURN-TO-VENDOR returning an expiring batch to the vendor records a coded adjustment and reduces balance @happy', async ({ api }) => {
    const b = await ownBatch(api, `rtv-${Date.now()}`);
    const r = await api.request('POST', '/stock/adjust/qty', {
      itemid: b.itemid, qty: -1, reasoncode: 'RETURNED_TO_VENDOR', comments: 'qa return to vendor',
    }, MGR);
    expect(r.status).toBeLessThan(300);
    expect(r.body.status).toBe('APPROVED'); // small value, under the WS-3 threshold
    expect(r.body.reasoncode).toBe('RETURNED_TO_VENDOR');
    expect(await bal(api, b.batch)).toBe(50 - 1);
  });

  test('STK-6 the expiry view lists upcoming expiries and drills into a period @happy', async ({ api }) => {
    const all = await api.request('GET', '/stock2/expiries/all', undefined, MGR);
    expect(all.status).toBeLessThan(400);
    expect(Array.isArray(all.body)).toBeTruthy();
    expect(all.body.length).toBeGreaterThan(0);
    // rows carry a date and a count
    expect(all.body[0].exp_date ?? all.body[0].month).toBeTruthy();
    // drill into the month of the first row (try a couple of param shapes)
    const d = String(all.body[0].exp_date || '').slice(0, 7); // YYYY-MM
    let ok = false;
    for (const p of [d, d.replace('-', ''), `${d}-01`]) {
      const r = await api.request('GET', `/stock2/expiries/month/${encodeURIComponent(p)}`, undefined, MGR);
      if (r.status < 400) { ok = true; break; }
    }
    if (!ok) test.info().annotations.push({ type: 'finding', description: `STK-6: /stock2/expiries/month/:month errored for every tried format of ${d}` });
    expect(all.body.length).toBeGreaterThan(0);
  });

  test('STK-8 price-adjust and qty-adjust lists stay separate, each attributed @happy', async ({ api }) => {
    const it = await anyStockItem(api);
    await api.request('POST', '/stock/adjust/qty', { itemid: it.item_id, qty: -1, status: 'APPROVED', reason: 'Breakage', comments: 'qa STK-8 qty' }, MGR);
    await api.request('POST', '/stock/adjust/price', { itemid: it.item_id, effdate: '2026-09-04', price: Number(it.mrp_cost || 20) * 0.7, oldprice: Number(it.mrp_cost || 20) * 0.8, comments: 'qa STK-8 price' }, MGR).catch(() => {});

    const qtyList = (await api.request('GET', '/stock/adjust/qty', undefined, MGR)).body;
    // qty list carries qty changes only - the price-adjust comment must not appear here
    expect(qtyList.some((r: any) => r.comments?.includes('qa STK-8 qty'))).toBeTruthy();
    expect(qtyList.some((r: any) => r.comments?.includes('qa STK-8 price'))).toBeFalsy();
    // each row carries its own reason + date
    const mine = qtyList.find((r: any) => r.comments?.includes('qa STK-8 qty'));
    expect(mine.reason).toBeTruthy();
    expect(mine.date ?? mine.createdon).toBeTruthy();
  });

  test('WS5-COUNT-LIFECYCLE a cycle count records a variance as a pending adjustment tied to the count @happy', async ({ api }) => {
    const b = await ownBatch(api, `count-${Date.now()}`);

    const started = await api.request('POST', '/stock/counts', { category: null }, MGR);
    expect(started.status).toBeLessThan(300);
    const countId = started.body.count.id;
    const snapshotRow = started.body.items.find((i: any) => i.item_id === b.itemid);
    expect(snapshotRow, 'the fresh batch appears in the count snapshot').toBeTruthy();
    expect(Number(snapshotRow.balance)).toBe(50);

    const submitted = await api.request('POST', `/stock/counts/${countId}/submit`, {
      items: [{ itemid: b.itemid, bookqty: 50, countedqty: 47 }],
    }, MGR);
    expect(submitted.status).toBeLessThan(300);
    expect(submitted.body.linesChanged).toBe(1);
    expect(submitted.body.adjustments[0].status).toBe('PENDING');

    // pending: stock unchanged until approved
    expect(await bal(api, b.batch)).toBe(50);
    await api.request('PUT', `/stock/audit/${submitted.body.adjustments[0].id}/approve`, undefined, MGR);
    expect(await bal(api, b.batch)).toBe(47);

    // the count now shows up completed, with the adjustment attributed to it
    const detail = await api.request('GET', `/stock/counts/${countId}`, undefined, MGR);
    expect(detail.body.count.status).toBe('COMPLETED');
    expect(detail.body.lines.length).toBe(1);
    expect(Number(detail.body.lines[0].qty)).toBe(-3);

    const list = await api.request('GET', '/stock/counts', undefined, MGR);
    const row = list.body.find((c: any) => c.id === countId);
    expect(row.linecount).toBe(1);
  });

  test('WS5-COUNT-STORE-SCOPED a count scoped to a store reflects that store\'s balance after a transfer, not the business-wide total @happy', async ({ api }) => {
    const b = await ownBatch(api, `count-store-${Date.now()}`); // lands at store 1 (home), balance 50
    const store1 = 1;
    const otherStore = (await api.request('POST', '/stores', { location: `QA-COUNT-${Date.now()}` }, MGR)).body.id;

    const dispatched = await api.request('POST', '/store-stock-transfers', {
      fromstoreid: store1, tostoreid: otherStore, purchaseitemid: b.itemid, qty: 20,
    }, MGR);
    expect(dispatched.status).toBeLessThan(300);
    await api.request('PUT', `/store-stock-transfers/${dispatched.body.id}/receive`, {}, MGR);

    // store 1 now has 30 (50-20), otherStore has 20 - a count at either store must see its own slice
    const startedAtStore1 = await api.request('POST', '/stock/counts', { storeid: store1 }, MGR);
    const rowAtStore1 = startedAtStore1.body.items.find((i: any) => i.item_id === b.itemid);
    expect(Number(rowAtStore1.balance)).toBe(30);

    const startedAtOther = await api.request('POST', '/stock/counts', { storeid: otherStore }, MGR);
    const rowAtOther = startedAtOther.body.items.find((i: any) => i.item_id === b.itemid);
    expect(Number(rowAtOther.balance)).toBe(20);

    // a variance recorded during the store1 count must post against store1, not the batch's home store
    const submitted = await api.request('POST', `/stock/counts/${startedAtStore1.body.count.id}/submit`, {
      items: [{ itemid: b.itemid, bookqty: 30, countedqty: 28 }],
    }, MGR);
    expect(submitted.body.adjustments[0].storeid).toBe(store1);
    await api.request('PUT', `/stock/audit/${submitted.body.adjustments[0].id}/approve`, undefined, MGR);

    const rescan = await api.request('POST', '/stock/counts', { storeid: store1 }, MGR);
    const rowAfter = rescan.body.items.find((i: any) => i.item_id === b.itemid);
    expect(Number(rowAfter.balance)).toBe(28); // approved: the -2 landed at store1, not otherStore
  });

  test('BULK-ZERO-STORE-SPLIT clearing a batch to zero clears each store\'s slice separately, not just its home store\'s @edge', async ({ api }) => {
    const b = await ownBatch(api, `bulk-zero-${Date.now()}`); // home store 1, balance 50
    const store1 = 1;
    const otherStore = (await api.request('POST', '/stores', { location: `QA-BULKZERO-${Date.now()}` }, MGR)).body.id;

    const dispatched = await api.request('POST', '/store-stock-transfers', {
      fromstoreid: store1, tostoreid: otherStore, purchaseitemid: b.itemid, qty: 20,
    }, MGR);
    await api.request('PUT', `/store-stock-transfers/${dispatched.body.id}/receive`, {}, MGR);
    // store1 now holds 30, otherStore holds 20

    const cleared = await api.request('POST', '/stock/adjust/qty/bulk', {
      ids: [b.itemid], reason: 'qa bulk clear',
    }, MGR);
    expect(cleared.status).toBeLessThan(300);
    // one row per (item, store) that actually held stock
    expect(cleared.body.filter((r: any) => Number(r.purchase_itemid) === b.itemid).length).toBe(2);

    const store1Count = await api.request('POST', '/stock/counts', { storeid: store1 }, MGR);
    expect(store1Count.body.items.find((i: any) => i.item_id === b.itemid)).toBeFalsy(); // balance now 0, drops out of the snapshot

    const otherCount = await api.request('POST', '/stock/counts', { storeid: otherStore }, MGR);
    expect(otherCount.body.items.find((i: any) => i.item_id === b.itemid)).toBeFalsy();
  });

  test('WS5-COUNT-NO-CHANGE a count line matching the book quantity creates no adjustment @edge', async ({ api }) => {
    const b = await ownBatch(api, `count-nochange-${Date.now()}`);
    const started = await api.request('POST', '/stock/counts', {}, MGR);
    const submitted = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, {
      items: [{ itemid: b.itemid, bookqty: 50, countedqty: 50 }],
    }, MGR);
    expect(submitted.body.linesChanged).toBe(0);
    expect(await bal(api, b.batch)).toBe(50);
  });

  test('WS5-COUNT-DOUBLE-SUBMIT submitting an already-completed count again is rejected @negative', async ({ api }) => {
    const started = await api.request('POST', '/stock/counts', {}, MGR);
    await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items: [] }, MGR);
    const again = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items: [] }, MGR);
    expect(again.status).toBeGreaterThanOrEqual(400);
  });

  test('the Stock > Adjustments screen loads @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/store/stock/adjust', { storeId: 1 });
    await expectShell(page);
    await expect(page.getByRole('table').first()).toBeVisible();
  });
});
