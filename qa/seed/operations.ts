/**
 * Transactional history on store 1 (the API pins sales/shifts to the first store):
 *   POs -> approve -> invoice/GRN (stock in)  then
 *   weeks of shifts, each with sales across cashiers, cash ledger entries,
 *   partial returns, then closed with a realistic counted-cash variance.
 * The last shift is left OPEN for the CASH-* specs.
 */
import { GET, POST, PUT, login } from './client.js';
import { SEED, PASSWORD } from './personas.js';
import { profile } from './volume.js';
import { faker } from './pharma.js';
import { pool, progress, isoAt, daysAgo, rand, randInt } from './util.js';
import type { Manifest } from './manifest.js';

const CASHIERS = [SEED.sales1, SEED.sales2];
const CASHIER_IDS: Record<string, number> = { [SEED.sales1]: 3, [SEED.sales2]: 4 };

/** greedy-break a cash amount into the fixed denomination set for the drawer count */
function toDenoms(amount: number): { d: number; n: number }[] {
  let left = Math.max(0, Math.round(amount));
  const rows: { d: number; n: number }[] = [];
  for (const d of [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]) {
    const n = Math.floor(left / d);
    if (n > 0) { rows.push({ d, n }); left -= n * d; }
  }
  return rows.length ? rows : [{ d: 1, n: 0 }];
}

export async function stockIn(m: Manifest) {
  const p = profile();
  const bh = await login(SEED.businessHead);

  // ensure the PO approval threshold exists (seed sets 5000; PO-9 spec mutates it)
  const settings = await GET<any[]>('/settings', { token: bh, query: { key: 'purchase_order_approval_value_threshold' } }).catch(() => []);
  if (!settings?.length) {
    await POST('/settings', {
      category: 'purchases', key: 'purchase_order_approval_value_threshold',
      value: '5000', description: 'Approval required above this estimated PO value',
    }, { token: bh }).catch(() => {});
  }

  const priced = m.products.filter((x) => x.priced);
  const stockProducts = faker.helpers.arrayElements(priced.length ? priced : m.products, Math.min(280, m.products.length));
  const perPo = Math.ceil(stockProducts.length / p.purchaseOrders);
  const groups = Array.from({ length: p.purchaseOrders }, (_, i) => stockProducts.slice(i * perPo, (i + 1) * perPo)).filter((g) => g.length);

  const poTick = progress('purchase orders + GRN', groups.length);
  let gi = 0;
  for (const group of groups) {
    gi++;
    const vendorid = rand(m.vendors);
    try {
      const po = await POST<any>('/purchaseorders', { vendorid, comments: 'qa-seed' }, { token: bh });
      const poid = po?.id;
      for (const prod of group) {
        const qty = randInt(30, 180);
        const pr = await POST<any>('/purchaserequests', { productid: prod.id, qty, vendorid }, { token: bh });
        if (pr?.id && poid) await PUT(`/purchaserequests/${pr.id}`, { orderid: poid }, { token: bh });
      }
      await POST(`/purchaseorders/${poid}/submit`, undefined, { token: bh });
      const poAfter = await GET<any>(`/purchaseorders/${poid}`, { token: bh });
      const approved = poAfter?.approvalstatus === 'Approved';
      m.purchaseOrders.push({ id: poid, approved });
      if (!approved) { poTick(); continue; } // leave PENDING_APPROVAL ones for PO specs

      const inv = await POST<any>('/purchases', {
        vendorid, purchaseorderid: String(poid),
        invoiceno: `QA-GRN-${poid}`, invoicedate: daysAgo(randInt(5, 25)),
      }, { token: bh });
      const invid = inv?.id;
      const itemIds: number[] = [];
      let invTotal = 0;
      for (const prod of group) {
        const ptr = faker.number.float({ min: 6, max: 260, fractionDigits: 2 });
        const qty = randInt(20, 120);
        const tax = faker.helpers.arrayElement([5, 12, 18]);
        const lineTotal = +(qty * ptr * (1 + tax / 100)).toFixed(2);
        invTotal += lineTotal;
        const it = await POST<any>('/purchaseitems', {
          invoiceid: invid, productid: prod.id, qty,
          ptrvalue: ptr, ptrcost: ptr, total: lineTotal,
          mrpcost: +(ptr * faker.number.float({ min: 1.3, max: 1.9, fractionDigits: 2 })).toFixed(2),
          taxpcnt: tax,
          batch: `B${poid}-${prod.id}`, expdate: daysAgo(-randInt(200, 700)).slice(0, 10),
          saleprice: +(ptr * 1.2).toFixed(2),
        }, { token: bh }).catch(() => null);
        if (it?.id) itemIds.push(it.id);
      }
      if (itemIds.length) {
        await PUT('/purchaseitems', { ids: itemIds, values: { status: 'VERIFIED' } }, { token: bh });
        // COMPLETE is the real invoice-level terminal status (matches the UI's "Complete" button);
        // payments can only be recorded against a COMPLETE invoice (issue: WS-1 payment validation)
        await PUT('/purchases/confirm', { ids: [invid], values: { status: 'COMPLETE', total: +invTotal.toFixed(2) } }, { token: bh });
        // pay ~half of them in full/part so both "outstanding" and "paid" states exist
        if (gi % 2 === 0) {
          await POST('/vendorpayments', {
            vendorid, invoiceid: invid, paydate: daysAgo(randInt(1, 10)),
            amount: +(invTotal * (gi % 4 === 0 ? 1 : 0.4)).toFixed(2), paymode: 'Transfer',
          }, { token: bh }).catch(() => {});
        }
      }
      m.invoices.push({ id: invid, confirmed: true });
    } catch (e) {
      console.warn(`  PO group ${gi} failed: ${(e as Error).message.slice(0, 120)}`);
    }
    poTick();
  }

  // sellable pool for the sales step
  const pool0 = await POST<any[]>('/stock/filter', { available: true, limit: 600 }, { token: bh });
  m.sellableItems = (pool0 || [])
    .filter((x) => Number(x.balance) > 5)
    .map((x) => {
      const mrp = Number(x.mrp_cost) || 25;
      const sp = Number(x.sale_price) || +(mrp * 0.85).toFixed(2);
      return {
        itemid: x.item_id, productid: x.id, batch: x.batch,
        price: Math.min(sp, +(mrp * 0.95).toFixed(2)),
        mrpcost: mrp,
        taxpcnt: Number(x.tax_pcnt) || 12,
      };
    });
  // A few POs left in PENDING_APPROVAL for the PO-3/4/5/6 specs. By now the
  // sampled products have a ptr_cost (from the GRNs above), so a big-qty line
  // clears the 5000 threshold and the submit routes to approval.
  let pending = 0;
  const stockedProductIds = [...new Set((pool0 || []).map((x: any) => x.id))].slice(0, 30);
  for (let i = 0; i < 4 && stockedProductIds.length; i++) {
    try {
      const vendorid = rand(m.vendors);
      const po = await POST<any>('/purchaseorders', { vendorid, comments: 'qa-seed pending' }, { token: bh });
      const prod = stockedProductIds[i % stockedProductIds.length];
      const pr = await POST<any>('/purchaserequests', { productid: prod, qty: 900, vendorid }, { token: bh });
      if (pr?.id) await PUT(`/purchaserequests/${pr.id}`, { orderid: po.id }, { token: bh });
      await POST(`/purchaseorders/${po.id}/submit`, undefined, { token: bh });
      const after = await GET<any>(`/purchaseorders/${po.id}`, { token: bh });
      const isPending = after?.approvalstatus === 'Pending' || after?.status === 'PENDING_APPROVAL';
      m.purchaseOrders.push({ id: po.id, approved: !isPending });
      if (isPending) pending++;
    } catch { /* skip */ }
  }

  m.stats.purchaseOrders = m.purchaseOrders.length;
  m.stats.pendingApprovalPOs = pending;
  m.stats.confirmedInvoices = m.invoices.length;
  m.stats.sellableItems = m.sellableItems.length;
  console.log(`  GRN done - ${m.invoices.length} invoices, ${m.sellableItems.length} sellable batches, ${pending} POs pending approval`);
}

export async function salesHistory(m: Manifest) {
  const p = profile();
  if (!m.sellableItems.length) { console.warn('  no sellable stock - skipping sales'); return; }

  const totalShifts = p.salesWeeks * p.shiftsPerWeek;
  const tick = progress('shifts + sales', totalShifts);
  let salesCount = 0;
  let returnsCount = 0;

  // only one open shift per store is allowed - close the demo-data one first
  const bh0 = await login(SEED.businessHead);
  const preOpen = await GET<any[]>('/store-cash/shifts', { token: bh0, query: { storeid: 1, status: 'OPEN' } }).catch(() => []);
  for (const sh of preOpen || []) {
    const amt = Number(sh.expectedcash ?? sh.openingcash ?? 0);
    await PUT(`/store-cash/shifts/${sh.id}/close`, { counteddenominations: toDenoms(amt), allowZero: true }, { token: bh0 }).catch(() => {});
  }

  for (let s = 0; s < totalShifts; s++) {
    const daysBack = Math.max(0, Math.round(((totalShifts - s) / p.shiftsPerWeek) * 7) - randInt(0, 3));
    const cashierEmail = CASHIERS[s % CASHIERS.length];
    const cashierId = CASHIER_IDS[cashierEmail];
    const bh = await login(SEED.businessHead);

    const isLast = s === totalShifts - 1;
    let shiftId: number | undefined;
    try {
      const openFloat = randInt(10, 30) * 100;
      const shift = await POST<any>('/store-cash/shifts', {
        storeid: 1, shiftdate: daysAgo(daysBack), openingdenominations: toDenoms(openFloat),
        // leave the final (still-open) shift unassigned so any cashier's sale links to it
        assigneduserid: isLast ? null : cashierId, name: s % 2 ? 'Evening' : 'Morning',
        starttime: s % 2 ? '14:00' : '09:00', endtime: s % 2 ? '22:00' : '15:00',
      }, { token: bh });
      shiftId = shift?.id;
    } catch (e) {
      console.warn(`  shift ${s} open failed: ${(e as Error).message.slice(0, 100)}`);
      tick(); continue;
    }

    const cashier = await login(cashierEmail);
    const nSales = randInt(p.salesPerShift[0], p.salesPerShift[1]);
    for (let i = 0; i < nSales; i++) {
      const lines = randInt(1, 4);
      const items = Array.from({ length: lines }, () => {
        const it = rand(m.sellableItems);
        const qty = randInt(1, 3);
        const gross = +(it.price * qty).toFixed(2);
        return { itemid: it.itemid, productid: it.productid, batch: it.batch, price: it.price,
          mrpcost: it.mrpcost, taxpcnt: it.taxpcnt, qty, total: +(gross * (1 + it.taxpcnt / 100)).toFixed(2) };
      });
      const total = +items.reduce((a, b) => a + b.total, 0).toFixed(2);
      const digitalShare = Math.random() < 0.45 ? faker.number.float({ min: 0.2, max: 1, fractionDigits: 2 }) : 0;
      const digiamt = +(total * digitalShare).toFixed(2);
      const cashamt = +(total - digiamt).toFixed(2);
      const when = isoAt(daysBack, (s % 2 ? 14 : 9) + randInt(0, 4), randInt(0, 59));
      try {
        const sale = await POST<any>('/sales', {
          customerid: rand(m.customers), billdate: when, orderdate: when,
          cashamt, digiamt, digimethod: digiamt > 0 ? rand(['UPI', 'Card']) : null,
          digirefno: digiamt > 0 ? faker.string.alphanumeric(10).toUpperCase() : null,
          total, discamount: 0, expreturndays: 7,
          status: 'COMPLETE', ordertype: rand(['Walk-in', 'Phone', 'Whatsapp']),
          deliverytype: 'Counter', items,
        }, { token: cashier });
        salesCount++;
        m.sales.push({ id: sale?.id, total, cash: cashamt, digital: digiamt });

        if (sale?.id && sale?.items?.length && Math.random() < p.returnFraction) {
          const li = rand(sale.items);
          await POST('/sales/returns', [{ saleitemid: li.id, qty: 1, reason: rand(['Not Effective', 'Defective', 'Prescription Change']) }],
            { token: cashier }).then(() => returnsCount++).catch(() => {});
        }
      } catch { /* skip a bad line */ }
    }

    // a couple of cash ledger entries per shift
    await POST('/store-cash/ledger', { storeid: 1, shiftid: shiftId, category: 'EXPENSE',
      withdraw: randInt(50, 400), description: rand(['Courier', 'Tea/Snacks', 'Stationery', 'Cleaning']) },
      { token: cashier }).catch(() => {});
    if (Math.random() < 0.3) {
      await POST('/store-cash/ledger', { storeid: 1, category: 'BANK_DEPOSIT',
        deposit: randInt(20, 60) * 100, description: 'Daily banking' }, { token: cashier }).catch(() => {});
    }

    // close all but the last shift
    if (s < totalShifts - 1 && shiftId) {
      const rpt = await GET<any>(`/store-cash/shifts/${shiftId}/report`, { token: bh }).catch(() => null);
      const expected = Number(rpt?.shift?.expectedcash ?? rpt?.expectedcash ?? 0);
      const counted = Math.max(0, +(expected + faker.number.float({ min: -120, max: 80, fractionDigits: 2 })).toFixed(2));
      await PUT(`/store-cash/shifts/${shiftId}/close`, { counteddenominations: toDenoms(counted), allowZero: true, notes: 'qa-seed close' }, { token: bh }).catch(() => {});
    }
    tick();
  }

  m.stats.sales = salesCount;
  m.stats.returns = returnsCount;
  m.stats.shifts = totalShifts;
  console.log(`  ${salesCount} sales, ${returnsCount} returns across ${totalShifts} shifts (last left OPEN)`);
}
