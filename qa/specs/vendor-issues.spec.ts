/**
 * Vendor grievances — VI-1..3
 * An invoice correction or defective goods is raised against a vendor, sent, the goods go back out of stock once, and the
 * business head records how the vendor settled it.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';

type Found = { vendor: number; invoice: number; store: number; item: any };

/** a vendor invoice with a batch that has at least 3 units at some store */
async function candidate(api: any): Promise<Found | null> {
  const o = (await api.request('GET', '/vendor-issues/options', undefined, MGR)).body;
  for (const v of o.vendors) {
    const invs = (await api.request('GET', `/vendor-issues/invoices?vendor_id=${v.id}`, undefined, MGR)).body;
    for (const inv of invs) {
      for (const st of o.stores) {
        const items = (await api.request('GET', `/vendor-issues/invoice-items?invoice_id=${inv.id}&store_id=${st.id}`, undefined, MGR)).body;
        const it = items.find((i: any) => i.available >= 3);
        if (it) return { vendor: v.id, invoice: inv.id, store: st.id, item: it };
      }
    }
  }
  return null;
}

test.describe('Vendor issues @p1', () => {
  test('VI-1 defective goods: raise, send, take out of stock once, settle with a credit note @happy', async ({ api }) => {
    const c = await candidate(api);
    test.skip(!c, 'no invoice batch with stock to send back');
    const raise = (b: any, who = MGR) => api.request('POST', '/vendor-issues', b, who);
    const base = { vendor_id: c!.vendor, invoice_id: c!.invoice, store_id: c!.store, kind: 'DEFECTIVE', summary: 'QA crushed strips' };
    const line = { purchase_item_id: c!.item.id, qty: 2 };

    // what is refused
    expect((await raise({ ...base, kind: 'NOPE', lines: [line] })).status).toBe(400);
    expect((await raise({ ...base, summary: '', lines: [line] })).status).toBe(400);
    expect((await raise({ ...base, lines: [] })).status).toBe(400);                                              // defective goods need lines
    expect((await raise({ ...base, lines: [{ ...line, qty: c!.item.available + 5 }] })).status).toBe(400);        // more than the store holds
    expect((await raise({ ...base, vendor_id: 99999999, lines: [line] })).status).toBe(400);
    expect((await raise({ ...base, lines: [line] }, COUNTER)).status).toBe(403);                                  // counter staff have no access

    const made = await raise({ ...base, details: 'two strips arrived crushed', lines: [line] });
    expect(made.status).toBeLessThan(300);
    const id = made.body.id;
    let issue = (await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body;
    expect(issue.issue_no).toMatch(/^VI\d{5}$/);
    expect(issue.status).toBe('OPEN');
    expect(issue.claimed).toBeCloseTo(2 * c!.item.ptr_cost, 1);
    expect(issue.lines.length).toBe(1);
    expect((await api.request('GET', '/vendor-issues?status=ACTIVE', undefined, MGR)).body.some((r: any) => r.id === id)).toBe(true);

    // sending: how, a date that is not past
    const send = (b: any) => api.request('POST', `/vendor-issues/${id}/send`, b, MGR);
    expect((await send({ via: 'CARRIER_PIGEON' })).status).toBe(400);
    expect((await send({ via: 'PHONE', due_on: '2020-01-01' })).status).toBe(400);
    expect((await send({ via: 'PHONE', vendor_ref: 'TKT-77' })).status).toBeLessThan(300);
    issue = (await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body;
    expect(issue).toMatchObject({ status: 'WITH_VENDOR', vendor_ref: 'TKT-77' });
    expect(issue.due_on).toBeTruthy();
    expect((await send({ via: 'PHONE' })).status).toBe(400);                                                      // already sent
    expect((await api.request('PUT', `/vendor-issues/${id}`, { summary: 'late edit' }, MGR)).status).toBe(400);   // locked once sent

    // the goods leave the store's stock, once
    const stock = async () => (await api.request('GET', `/vendor-issues/invoice-items?invoice_id=${c!.invoice}&store_id=${c!.store}`, undefined, MGR)).body.find((i: any) => i.id === c!.item.id).available as number;
    const before = await stock();
    const back = await api.request('POST', `/vendor-issues/${id}/return`, {}, MGR);
    expect(back.status).toBeLessThan(300);
    expect(back.body.moved).toBe(2);
    expect(await stock()).toBe(before - 2);
    expect((await api.request('POST', `/vendor-issues/${id}/return`, {}, MGR)).status).toBe(400);                  // nothing left to send
    expect((await api.request('POST', `/vendor-issues/${id}/cancel`, {}, MGR)).status).toBe(400);

    // only the business head settles it, with the right paperwork
    const resolve = (b: any, who = MGR) => api.request('POST', `/vendor-issues/${id}/resolve`, b, who);
    expect((await resolve({ resolution: 'CREDIT_NOTE', credit_amount: 50, credit_ref: 'CN1' }, STOREHEAD)).status).toBe(403);
    expect((await resolve({ resolution: 'MAGIC' })).status).toBe(400);
    expect((await resolve({ resolution: 'CREDIT_NOTE', credit_ref: 'CN1' })).status).toBe(400);                    // an amount
    expect((await resolve({ resolution: 'CREDIT_NOTE', credit_amount: 50 })).status).toBe(400);                    // a credit note number
    expect((await resolve({ resolution: 'CREDIT_NOTE', credit_amount: issue.claimed, credit_ref: 'CN-QA-1', note: 'adjusted on the next invoice' })).status).toBeLessThan(300);
    issue = (await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body;
    expect(issue).toMatchObject({ status: 'RESOLVED', resolution: 'CREDIT_NOTE', credit_ref: 'CN-QA-1' });
    expect(issue.credit_amount).toBeCloseTo(issue.claimed, 1);
    expect(issue.notes.length).toBeGreaterThanOrEqual(3);                                                          // sent, goods back, settled
    expect((await resolve({ resolution: 'REFUND', credit_amount: 1 })).status).toBe(400);                          // already closed

    // reopened, refused with a reason
    expect((await api.request('POST', `/vendor-issues/${id}/reopen`, {}, STOREHEAD)).status).toBe(403);
    expect((await api.request('POST', `/vendor-issues/${id}/reopen`, {}, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body.status).toBe('WITH_VENDOR');
    expect((await api.request('POST', `/vendor-issues/${id}/reject`, {}, MGR)).status).toBe(400);
    expect((await api.request('POST', `/vendor-issues/${id}/reject`, { note: 'out of the claim window' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body.status).toBe('REJECTED');

    // the scorecard counts it
    const card = (await api.request('GET', '/vendor-issues/scorecard', undefined, MGR)).body.find((r: any) => r.vendor_id === c!.vendor);
    expect(card.issues).toBeGreaterThan(0);
    expect(card.refused).toBeGreaterThan(0);
    expect((await api.request('GET', '/vendor-issues/scorecard', undefined, STOREHEAD)).status).toBe(403);
  });

  test('VI-2 an invoice correction names what is wrong on each line, and can be edited until it is sent @edge', async ({ api }) => {
    const c = await candidate(api);
    test.skip(!c, 'no invoice to correct');
    const raise = (b: any) => api.request('POST', '/vendor-issues', { vendor_id: c!.vendor, invoice_id: c!.invoice, store_id: c!.store, kind: 'INVOICE_FIX', summary: 'QA wrong rate', ...b }, MGR);

    expect((await raise({ lines: [] })).status).toBe(400);
    expect((await raise({ lines: [{ purchase_item_id: c!.item.id, billed_value: '10', correct_value: '9', amount: 50 }] })).status).toBe(400);   // which field?
    expect((await raise({ lines: [{ purchase_item_id: c!.item.id, field: 'COLOUR', amount: 5 }] })).status).toBe(400);
    expect((await raise({ lines: [{ description: 'x', field: 'RATE', amount: -5 }] })).status).toBe(400);
    expect((await raise({ invoice_id: 99999999, lines: [{ description: 'x', field: 'RATE', amount: 5 }] })).status).toBe(400);

    const made = await raise({ lines: [{ purchase_item_id: c!.item.id, field: 'RATE', billed_value: '10.00', correct_value: '9.00', amount: 50 }] });
    expect(made.status).toBeLessThan(300);
    const id = made.body.id;
    let issue = (await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body;
    expect(issue.claimed).toBe(50);
    expect(issue.lines[0]).toMatchObject({ field: 'RATE', billed_value: '10.00', correct_value: '9.00' });

    // still open: the lines can be replaced and the claim follows them
    const upd = await api.request('PUT', `/vendor-issues/${id}`, { summary: 'QA wrong rate and tax', lines: [
      { purchase_item_id: c!.item.id, field: 'RATE', billed_value: '10.00', correct_value: '9.00', amount: 50 },
      { description: 'GST on the same line', field: 'TAX', billed_value: '12', correct_value: '5', amount: 20 }] }, MGR);
    expect(upd.status).toBeLessThan(300);
    issue = (await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body;
    expect(issue.claimed).toBe(70);
    expect(issue.lines.length).toBe(2);

    // no goods to send back on a correction; the vendor can settle with a corrected invoice, no money
    expect((await api.request('POST', `/vendor-issues/${id}/return`, {}, MGR)).status).toBe(400);
    expect((await api.request('POST', `/vendor-issues/${id}/notes`, { note: 'called the accounts desk' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', `/vendor-issues/${id}/resolve`, { resolution: 'CORRECTED_INVOICE', note: 'new invoice INV-9' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/vendor-issues/${id}`, undefined, MGR)).body.status).toBe('RESOLVED');

    // an unsent issue can simply be cancelled
    const other = await raise({ lines: [{ description: 'a line', field: 'QTY', billed_value: '10', correct_value: '8', amount: 5 }] });
    expect((await api.request('POST', `/vendor-issues/${other.body.id}/cancel`, {}, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/vendor-issues/${other.body.id}`, undefined, MGR)).body.status).toBe('CANCELLED');
  });

  test('VI-3 the Vendor issues page and who sees it @happy', async ({ app, api }) => {
    const c = await candidate(api);
    test.skip(!c, 'no invoice batch with stock');
    const made = await api.request('POST', '/vendor-issues', { vendor_id: c!.vendor, invoice_id: c!.invoice, store_id: c!.store, kind: 'DEFECTIVE', summary: 'QA UI issue', lines: [{ purchase_item_id: c!.item.id, qty: 1 }] }, MGR);
    expect(made.status).toBeLessThan(300);

    const { page } = await app.open(MGR, '/secure/vendor-issues');
    await expectShell(page);
    await expect(page.getByTestId('nav-vendor-issues')).toBeVisible();
    const row = page.getByTestId('vi-row').filter({ hasText: 'QA UI issue' });
    await expect(row).toBeVisible();
    await row.getByTestId('vi-open-row').click();
    await expect(page.getByTestId('vi-detail')).toContainText('QA UI issue');
    await page.getByTestId('vi-note-text').fill('QA note from the page');
    await page.getByTestId('vi-note-add').click();
    await expect(page.getByTestId('vi-notes')).toContainText('QA note from the page');
    await page.getByTestId('vi-send').click();
    await page.getByTestId('vi-s-save').click();
    await expect(page.getByTestId('vi-status')).toContainText('With the vendor');
    await expect(page.getByTestId('vi-resolve')).toBeVisible();                       // the Business Head decides

    const sh = await app.open(STOREHEAD, '/secure/dashboard');
    await expect(sh.page.getByTestId('nav-vendor-issues')).toBeVisible();
    const cn = await app.open(COUNTER, '/secure/dashboard');
    await expect(cn.page.getByTestId('nav-vendor-issues')).toHaveCount(0);
  });
});
