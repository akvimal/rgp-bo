/**
 * Purchase invoices — pending view, payment info, hold — PINV-1..6
 * The invoice list as the person who pays sees it: chips with totals, working filters, payment history with
 * corrections and reversals, and holds.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const PAGE = '/secure/purchases/invoices/list';

/** the first received invoice that still has a balance worth paying against */
async function pendingInvoice(api: any, min = 20) {
  const r = await api.request('GET', '/purchases/search?view=pending&limit=100&sort=balance_amount&dir=desc', undefined, MGR);
  expect(r.status).toBe(200);
  return r.body.data.find((i: any) => i.balance_amount >= min && i.payment_status !== 'On Hold') ?? null;
}

test.describe('Purchase invoices — pending view @p1', () => {
  test('PINV-1 the chip totals match what each view lists @integration', async ({ api }) => {
    const sum = (await api.request('GET', '/purchases/summary', undefined, MGR)).body;
    for (const [view, key] of [['pending', 'pending'], ['overdue', 'overdue'], ['due7', 'due7'], ['hold', 'hold'], ['paid', 'paid'], ['draft', 'draft']] as const) {
      const list = await api.request('GET', `/purchases/search?view=${view}&limit=100`, undefined, MGR);
      expect(list.status).toBe(200);
      expect(list.body.total, `count for ${view}`).toBe(sum[key].count);
      if (list.body.total <= 100 && ['pending', 'overdue', 'due7', 'hold'].includes(view)) {
        const owed = list.body.data.reduce((t: number, r: any) => t + r.balance_amount, 0);
        expect(Math.abs(owed - sum[key].amount), `amount for ${view}`).toBeLessThan(1);
      }
    }
    // overdue, due-in-7-days and hold are parts of pending
    expect(sum.overdue.count + sum.due7.count + sum.hold.count).toBeLessThanOrEqual(sum.pending.count);
  });

  test('PINV-2 a draft invoice is never owed, never in Outstanding, and cannot be paid @edge', async ({ api }) => {
    let drafts = await api.request('GET', '/purchases/search?view=draft&limit=50', undefined, MGR);
    expect(drafts.status).toBe(200);
    if (drafts.body.total === 0) {
      // make one: an invoice entered but not received
      const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
      const made = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA-DRAFT-${Date.now()}`, invoicedate: '2026-09-04', total: 500 }, MGR);
      expect(made.status).toBeLessThan(300);
      drafts = await api.request('GET', '/purchases/search?view=draft&limit=50', undefined, MGR);
    }
    expect(drafts.body.total).toBeGreaterThan(0);
    const d = drafts.body.data[0];
    expect(d.payment_status).toBe('Draft');
    const pending = (await api.request('GET', `/purchases/search?view=pending&vendor=${d.vendor_id}&limit=100`, undefined, MGR)).body.data;
    expect(pending.some((i: any) => i.id === d.id)).toBe(false);
    const outstanding = (await api.request('GET', `/purchases/outstanding?vendorid=${d.vendor_id}`, undefined, MGR)).body;
    expect(outstanding.some((i: any) => i.id === d.id)).toBe(false);
    const pay = await api.request('POST', '/vendorpayments', { vendorid: d.vendor_id, invoiceid: d.id, paydate: '2026-09-04', amount: 1, paymode: 'Cash' }, MGR);
    expect(pay.status).toBe(400);
  });

  test('PINV-3 filters narrow the list correctly and paging adds up @happy', async ({ api }) => {
    const all = (await api.request('GET', '/purchases/search?view=all&limit=100', undefined, MGR)).body;
    test.skip(all.total === 0, 'no invoices in this data set');
    const first = all.data[0];
    const byVendor = (await api.request('GET', `/purchases/search?view=all&vendor=${first.vendor_id}&limit=100`, undefined, MGR)).body;
    expect(byVendor.data.length).toBeGreaterThan(0);
    expect(byVendor.data.every((i: any) => i.vendor_id === first.vendor_id)).toBe(true);

    const byNo = (await api.request('GET', `/purchases/search?q=${encodeURIComponent(first.invoice_no)}&limit=100`, undefined, MGR)).body;
    expect(byNo.data.some((i: any) => i.id === first.id)).toBe(true);
    expect(byNo.data.every((i: any) => i.invoice_no.toLowerCase().includes(first.invoice_no.toLowerCase()))).toBe(true);

    const day = String(first.invoice_date).slice(0, 10);
    const byDate = (await api.request('GET', `/purchases/search?from=${day}&to=${day}&limit=100`, undefined, MGR)).body;
    expect(byDate.data.every((i: any) => String(i.invoice_date).slice(0, 10) === day)).toBe(true);

    // paging: two pages of 5 are the first 10 of one page of 10, in the same order
    const p1 = (await api.request('GET', '/purchases/search?view=all&limit=5&page=1&sort=invoice_no&dir=asc', undefined, MGR)).body;
    const p2 = (await api.request('GET', '/purchases/search?view=all&limit=5&page=2&sort=invoice_no&dir=asc', undefined, MGR)).body;
    const ten = (await api.request('GET', '/purchases/search?view=all&limit=10&page=1&sort=invoice_no&dir=asc', undefined, MGR)).body;
    expect([...p1.data, ...p2.data].map((i: any) => i.id)).toEqual(ten.data.map((i: any) => i.id));
  });

  test('PINV-4 payment details can be corrected but the amount cannot; a reversed payment is frozen; changes are audited @integration', async ({ api }) => {
    const inv = await pendingInvoice(api);
    test.skip(!inv, 'no pending invoice with a balance in this data set');
    const rec = await api.request('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: 10, paymode: 'Cash', transref: 'QA-PINV-4' }, MGR);
    expect(rec.status).toBeLessThan(300);
    const id = rec.body.id;

    expect((await api.request('PUT', `/vendorpayments/${id}`, { amount: 999 }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/vendorpayments/${id}`, { paydate: '2031-01-01' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/vendorpayments/${id}`, { paymode: '' }, MGR)).status).toBe(400);
    const ok = await api.request('PUT', `/vendorpayments/${id}`, { paymode: 'UPI', transref: 'UTR-QA-123', remarks: 'corrected' }, MGR);
    expect(ok.status).toBeLessThan(300);

    const hist = (await api.request('GET', `/purchases/${inv.id}/payments`, undefined, MGR)).body;
    const row = hist.find((p: any) => p.id === id);
    expect(row.paymode).toBe('UPI');
    expect(row.transref).toBe('UTR-QA-123');
    expect(Number(row.amount)).toBe(10);
    expect(row.createdby).toBeTruthy();

    const audit = await api.request('GET', `/audit?action=payment.info_updated&entitytype=vendorpayments&entityid=${id}&limit=5`, undefined, MGR);
    expect(audit.body.rows.length).toBeGreaterThan(0);
    expect(audit.body.rows[0].details.after.transref).toBe('UTR-QA-123');

    expect((await api.request('POST', `/vendorpayments/${id}/reverse`, { reason: 'QA' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('PUT', `/vendorpayments/${id}`, { transref: 'AFTER-REVERSAL' }, MGR)).status).toBe(400);
    const after = (await api.request('GET', `/purchases/search?q=${encodeURIComponent(inv.invoice_no)}&vendor=${inv.vendor_id}&limit=10`, undefined, MGR)).body.data.find((i: any) => i.id === inv.id);
    expect(after.balance_amount).toBeCloseTo(inv.balance_amount, 1);   // the payment and its reversal cancel out
  });

  test('PINV-5 a held invoice cannot be paid until released @edge', async ({ api }) => {
    const inv = await pendingInvoice(api);
    test.skip(!inv, 'no pending invoice with a balance in this data set');
    expect((await api.request('POST', `/purchases/${inv.id}/hold`, { reason: 'no' }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/purchases/${inv.id}/hold`, { reason: 'QA: rate differs from the PO' }, MGR)).status).toBeLessThan(300);
    try {
      const held = (await api.request('GET', '/purchases/search?view=hold&limit=100', undefined, MGR)).body.data.find((i: any) => i.id === inv.id);
      expect(held.payment_status).toBe('On Hold');
      expect(held.hold_reason).toContain('rate differs');
      const pay = await api.request('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: 5, paymode: 'Cash' }, MGR);
      expect(pay.status).toBe(400);
    } finally {
      expect((await api.request('POST', `/purchases/${inv.id}/release`, undefined, MGR)).status).toBeLessThan(300);
    }
    const back = (await api.request('GET', '/purchases/search?view=pending&limit=100&sort=balance_amount&dir=desc', undefined, MGR)).body.data.find((i: any) => i.id === inv.id);
    expect(back?.payment_status).not.toBe('On Hold');
  });

  test('PINV-6 the invoice screen shows the chips, filters by chip, and records a payment @happy', async ({ app, api }) => {
    const inv = await pendingInvoice(api);
    test.skip(!inv, 'no pending invoice with a balance in this data set');
    const { page } = await app.open(MGR, PAGE);
    await expectShell(page);
    for (const c of ['pending', 'overdue', 'due7', 'hold', 'paid', 'draft']) await expect(page.getByTestId(`inv-chip-${c}`)).toBeVisible();

    await page.getByTestId('inv-chip-pending').click();
    await expect(page.getByTestId('inv-row').first()).toBeVisible();
    const sum = (await api.request('GET', '/purchases/summary', undefined, MGR)).body;
    await expect(page.getByTestId('inv-count')).toContainText(String(sum.pending.count));

    await page.getByTestId('inv-search').fill(inv.invoice_no);
    await page.getByTestId('inv-search').press('Enter');
    const row = page.getByTestId('inv-row').filter({ hasText: inv.invoice_no }).first();
    await expect(row).toBeVisible();
    await row.getByTestId('inv-pay').click();
    await expect(page.getByTestId('inv-pay-dialog')).toBeVisible();
    await page.getByTestId('inv-pay-amount').fill('10');
    await page.getByTestId('inv-pay-ref').fill('QA-PINV-6');
    await page.getByTestId('inv-pay-save').click();
    await expect(page.getByTestId('inv-message')).toContainText('recorded');

    // tidy up: reverse what the screen just recorded
    const hist = (await api.request('GET', `/purchases/${inv.id}/payments`, undefined, MGR)).body;
    const mine = hist.find((p: any) => p.transref === 'QA-PINV-6' && p.status !== 'REVERSED');
    expect(mine).toBeTruthy();
    await api.request('POST', `/vendorpayments/${mine.id}/reverse`, { reason: 'QA cleanup' }, MGR);
  });
});
