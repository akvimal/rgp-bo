/**
 * Per-store stock (WS-6, docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md).
 * New feature, not part of the original 120-case manual-test-plan.html.
 *
 * Business 1 (RGP Pharmacy) is single-store in the seed, so each test creates its own
 * second store to exercise the split: a purchase invoice now says which store received
 * the stock, and a transfer moves a batch from one store's stock to another's.
 *
 * Balances (and transfer `qty`) are in *sale units*, not purchase packs - the seed's
 * products carry a randomized pack size (1/10/15/30, see qa/seed/pharma.ts), so every
 * balance assertion here multiplies the purchased pack-count by the product's actual pack.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function newStore(api: any, tag: string) {
  const store = await api.request('POST', '/stores', { location: `QA-XFER-${tag}` }, MGR);
  return store.body.id as number;
}

async function getPack(api: any, productid: number): Promise<number> {
  const p = await api.request('GET', `/products/${productid}`, undefined, MGR);
  return Number(p.body.pack || 1);
}

async function invoiceAt(api: any, storeid: number, productid: number, purchaseQty: number, tag: string) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', {
    vendorid: v, storeid, invoiceno: `QA-XFER-${tag}`, invoicedate: '2026-07-01',
  }, MGR);
  const lineTotal = +(purchaseQty * 15 * 1.12).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid, qty: purchaseQty, ptrvalue: 15, ptrcost: 15, mrpcost: 22,
    taxpcnt: 12, total: lineTotal, batch: `XFER-${tag}`, expdate: '2028-06-30', saleprice: 20,
  }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lineTotal } }, MGR);
  return { invoiceid: inv.body.id, itemid: it.body.id, storeid };
}

async function balanceAtStore(api: any, productid: number, itemid: number, storeid: number) {
  const rows = (await api.request('POST', '/stock/filter', { id: productid, storeid }, MGR)).body;
  const row = rows.find((r: any) => r.item_id === itemid);
  return row ? Number(row.balance) : 0;
}

test.describe('Store Stock Transfer @p1', () => {
  test('INVOICE-STORE a purchase invoice with no store defaults to the business\'s first store @happy', async ({ api }) => {
    const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
    const inv = await api.request('POST', '/purchases', {
      vendorid: v, invoiceno: `QA-XFER-NOSTORE-${Date.now()}`, invoicedate: '2026-07-01',
    }, MGR);
    expect(inv.status).toBeLessThan(300);
    expect(inv.body.storeid).toBeTruthy();
  });

  test('XFER-SPLIT a batch received at one store is invisible to another until transferred @happy', async ({ api }) => {
    const store2 = await newStore(api, `split-${Date.now()}`);
    const productid = data.m.products[10].id;
    const pack = await getPack(api, productid);
    const batch = await invoiceAt(api, store2, productid, 40, `split-${store2}`);

    // business 1 (RGP Pharmacy) is single-store in the seed - store id 1 is its "Main Store"
    // (same assumption qa/seed/operations.ts documents for its own store-scoped calls).
    const store1 = 1;
    const atStore2 = await balanceAtStore(api, productid, batch.itemid, store2);
    const atStore1 = await balanceAtStore(api, productid, batch.itemid, store1);
    expect(atStore2).toBe(40 * pack);
    expect(atStore1).toBe(0);
  });

  test('XFER-LIFECYCLE dispatch then receive moves stock from one store\'s balance to the other\'s @happy', async ({ api }) => {
    const store2 = await newStore(api, `life-${Date.now()}`);
    // business 1 (RGP Pharmacy) is single-store in the seed - store id 1 is its "Main Store"
    // (same assumption qa/seed/operations.ts documents for its own store-scoped calls).
    const store1 = 1;
    const productid = data.m.products[11].id;
    const pack = await getPack(api, productid);
    const batch = await invoiceAt(api, store2, productid, 40, `life-${store2}`);
    const total = 40 * pack;
    const moveQty = 15 * pack;

    const dispatched = await api.request('POST', '/store-stock-transfers', {
      fromstoreid: store2, tostoreid: store1, purchaseitemid: batch.itemid, qty: moveQty,
    }, MGR);
    expect(dispatched.status).toBeLessThan(300);
    expect(dispatched.body.status).toBe('IN_TRANSIT');

    // in transit: deducted from the source, not yet on the destination's shelf
    expect(await balanceAtStore(api, productid, batch.itemid, store2)).toBe(total - moveQty);
    expect(await balanceAtStore(api, productid, batch.itemid, store1)).toBe(0);

    const received = await api.request('PUT', `/store-stock-transfers/${dispatched.body.id}/receive`, {}, MGR);
    expect(received.status).toBeLessThan(300);
    expect(received.body.status).toBe('RECEIVED');

    expect(await balanceAtStore(api, productid, batch.itemid, store2)).toBe(total - moveQty);
    expect(await balanceAtStore(api, productid, batch.itemid, store1)).toBe(moveQty);
  });

  test('XFER-OVERDRAW dispatching more than a store has is rejected @edge', async ({ api }) => {
    const store2 = await newStore(api, `over-${Date.now()}`);
    // business 1 (RGP Pharmacy) is single-store in the seed - store id 1 is its "Main Store"
    // (same assumption qa/seed/operations.ts documents for its own store-scoped calls).
    const store1 = 1;
    const productid = data.m.products[12].id;
    const batch = await invoiceAt(api, store2, productid, 10, `over-${store2}`);

    // 999 sale units comfortably exceeds any purchase-qty(10) x pack(<=30) combination
    const res = await api.request('POST', '/store-stock-transfers', {
      fromstoreid: store2, tostoreid: store1, purchaseitemid: batch.itemid, qty: 999999,
    }, MGR);
    expect(res.status).toBe(400);
  });

  test('XFER-CANCEL cancelling an in-transit transfer restores the source store\'s balance @edge', async ({ api }) => {
    const store2 = await newStore(api, `cancel-${Date.now()}`);
    // business 1 (RGP Pharmacy) is single-store in the seed - store id 1 is its "Main Store"
    // (same assumption qa/seed/operations.ts documents for its own store-scoped calls).
    const store1 = 1;
    const productid = data.m.products[13].id;
    const pack = await getPack(api, productid);
    const batch = await invoiceAt(api, store2, productid, 20, `cancel-${store2}`);
    const total = 20 * pack;
    const moveQty = 8 * pack;

    const dispatched = await api.request('POST', '/store-stock-transfers', {
      fromstoreid: store2, tostoreid: store1, purchaseitemid: batch.itemid, qty: moveQty,
    }, MGR);
    expect(await balanceAtStore(api, productid, batch.itemid, store2)).toBe(total - moveQty);

    const cancelled = await api.request('PUT', `/store-stock-transfers/${dispatched.body.id}/cancel`, {}, MGR);
    expect(cancelled.status).toBeLessThan(300);
    expect(await balanceAtStore(api, productid, batch.itemid, store2)).toBe(total);
  });
});
