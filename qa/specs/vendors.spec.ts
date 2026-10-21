/**
 * Vendors — VEND-1..4
 * Source: docs/testing/manual-test-plan.html  (module "vendors")
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';
import { breakCheck, randomGstin, withCheck } from '../support/gstin.js';

const MGR = 'businesshead@local.test';

test.describe('Vendors @p1', () => {
  test('VEND-1 a new vendor is saved and selectable on a Purchase Order @happy', async ({ app, api }) => {
    const name = `QA Vendor ${Date.now()}`;
    const { page } = await app.open(MGR, '/secure/purchases/vendors/new');
    await expectShell(page);
    await page.getByTestId(TID.vendorFName).fill(name);
    await page.getByTestId(TID.vendorFGstn).fill(withCheck('29ABCDE1234F1Z'));
    await page.getByTestId(TID.vendorFContact).fill('QA Contact');
    await page.getByTestId(TID.vendorFPhone).fill('9812345678');
    await expect(page.getByTestId(TID.vendorFSubmit)).toBeEnabled();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/vendors') && r.request().method() === 'POST'),
      page.getByTestId(TID.vendorFSubmit).click(),
    ]);
    expect(resp.status()).toBeLessThan(400);

    await expect.poll(async () =>
      (await api.request('GET', '/vendors', undefined, MGR)).body.some((v: any) => v.name === name),
    ).toBeTruthy();
  });

  test('VEND-2 a duplicate vendor - confirm the actual behaviour @negative', async ({ api }) => {
    const existing = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
    const dup = await api.request('POST', '/vendors', {
      name: existing.name, contactname: 'x', contactphone: '9000000000', address: 'x', gstn: existing.gstn, comments: '',
    }, MGR);
    // the plan leaves warn-vs-block undecided; record what the API actually does
    const behaviour = dup.status === 409 || dup.status >= 400 ? 'blocked' : 'allowed (created a second vendor)';
    test.info().annotations.push({ type: 'finding', description: `VEND-2: a duplicate vendor name/GST is ${behaviour} (HTTP ${dup.status})` });
    expect(dup.status).toBeLessThan(500);
  });

  test('VEND-3 a deactivated vendor drops off new orders but stays on history @edge', async ({ api }) => {
    const v = await api.request('POST', '/vendors', {
      name: `QA Deac ${Date.now()}`, contactname: 'x', contactphone: '9000000001', address: 'x', gstn: randomGstin('29'), comments: '',
    }, MGR);
    const id = v.body.id;
    // put it on a PO first (history)
    const po = await api.request('POST', '/purchaseorders', { vendorid: id }, MGR);
    await api.request('DELETE', `/vendors/${id}`, undefined, MGR);

    const active = await api.request('GET', '/vendors', undefined, MGR);
    expect(active.body.some((x: any) => x.id === id)).toBeFalsy(); // gone from the pick list
    const histPo = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
    expect(histPo.body.vendorid).toBe(id); // still referenced on the old order
  });

  test('VEND-4 recording a payment drops the outstanding balance by exactly the amount @happy', async ({ api }) => {
    let outstanding = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body
      .find((i: any) => Number(i.balance_amount) > 200);
    if (!outstanding) {
      // create one: fresh approved-PO -> GRN with a real total, unpaid
      const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
      const prod = data.m.products[30].id;
      const po = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
      const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 15, vendorid: v }, MGR);
      await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
      await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
      const st = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
      if (st.body.status === 'PENDING_APPROVAL') await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
      const inv = await api.request('POST', '/purchases', { vendorid: v, purchaseorderid: String(po.body.id), invoiceno: `QA-V4-${po.body.id}`, invoicedate: '2026-09-04' }, MGR);
      const lt = +(15 * 20 * 1.12).toFixed(2);
      const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod, qty: 15, ptrvalue: 20, ptrcost: 20, mrpcost: 30, taxpcnt: 12, total: lt, batch: `V4-${po.body.id}`, expdate: '2028-06-30', saleprice: 26 }, MGR);
      await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
      await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lt } }, MGR);
      outstanding = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body.find((i: any) => i.id === inv.body.id);
    }
    expect(outstanding, 'an invoice with a balance').toBeTruthy();
    const before = Number(outstanding.balance_amount);
    const amount = 150;

    const pay = await api.request('POST', '/vendorpayments', {
      vendorid: outstanding.vendor_id, invoiceid: outstanding.id,
      paydate: '2026-09-04', amount, paymode: 'Transfer',
    }, MGR);
    expect([200, 201]).toContain(pay.status);

    const inv = await api.request('GET', `/purchases/${outstanding.id}`, undefined, MGR);
    expect(Math.abs((before - Number(inv.body.balanceamount)) - amount)).toBeLessThan(0.5);
  });

  test('VEND-4b partial then clearing payments track the running balance @edge', async ({ api }) => {
    const inv = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body
      .find((i: any) => Number(i.balance_amount) > 50);
    test.skip(!inv, 'no outstanding invoice with a usable balance');
    const bal = Number(inv.balance_amount);
    const half = Math.floor(bal / 2);

    await api.request('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: half, paymode: 'Transfer' }, MGR);
    let cur = await api.request('GET', `/purchases/${inv.id}`, undefined, MGR);
    expect(Math.abs(Number(cur.body.balanceamount) - (bal - half))).toBeLessThan(1);

    await api.request('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: bal - half, paymode: 'Cash' }, MGR);
    cur = await api.request('GET', `/purchases/${inv.id}`, undefined, MGR);
    expect(Number(cur.body.balanceamount)).toBeLessThanOrEqual(0.5);
    expect(String(cur.body.paymentstatus).toLowerCase()).toContain('paid');
  });
});

test.describe('Vendor master @p1', () => {
  const mk = (extra: Record<string, unknown> = {}) => ({ name: `QA VM ${Date.now()}-${Math.floor(Math.random() * 1e6)}`, ...extra });

  test('VEND-5 a GSTIN is checked and its state, PAN and registration are filled in @negative', async ({ api }) => {
    const good = randomGstin('27');
    const bad = await api.request('POST', '/vendors', mk({ gstn: breakCheck(good) }), MGR);
    expect(bad.status).toBe(400);
    const ok = await api.request('POST', '/vendors', mk({ gstn: good.toLowerCase() }), MGR);
    expect(ok.status).toBeLessThan(300);
    const got = (await api.request('GET', `/vendors/${ok.body.id}`, undefined, MGR)).body;
    expect(got.gstn).toBe(good);
    expect(got.statecode).toBe('27');
    expect(got.pan).toBe(good.substring(2, 12));
    expect(got.registrationtype).toBe('REGULAR');
  });

  test('VEND-6 registration rules and duplicate GSTIN are enforced @negative', async ({ api }) => {
    const g = randomGstin('33');
    expect((await api.request('POST', '/vendors', mk({ gstn: g, registrationtype: 'UNREGISTERED' }), MGR)).status).toBe(400);
    expect((await api.request('POST', '/vendors', mk({ registrationtype: 'REGULAR' }), MGR)).status).toBe(400);
    expect((await api.request('POST', '/vendors', mk({ registrationtype: 'UNREGISTERED' }), MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', '/vendors', mk({ gstn: g }), MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', '/vendors', mk({ gstn: g }), MGR)).status).toBe(409);
  });

  test('VEND-7 contact and bank formats are checked and a mobile is normalised @negative', async ({ api }) => {
    for (const bad of [{ pincode: '12' }, { email: 'nope' }, { bankifsc: 'ABC' }, { upiid: 'bad' }, { pan: 'X' }, { mobile: '12345' }, { repphone: '1' }, { discountpcnt: 150 }]) {
      expect((await api.request('POST', '/vendors', mk(bad), MGR)).status).toBe(400);
    }
    const v = await api.request('POST', '/vendors', mk({ mobile: '+91 98765 43210', bankifsc: 'hdfc0001234', email: 'a@b.in' }), MGR);
    expect(v.status).toBeLessThan(300);
    const got = (await api.request('GET', `/vendors/${v.body.id}`, undefined, MGR)).body;
    expect(got.mobile).toBe('9876543210');
    expect(got.bankifsc).toBe('HDFC0001234');
  });

  test('VEND-8 licence status uses the soonest type, a renewal supersedes, bad dates are refused @edge', async ({ api }) => {
    const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const v = await api.request('POST', '/vendors', mk({
      licenses: [
        { licensetype: 'WHOLESALE_20B_21B', number: 'QA-W-1', validto: day(20) },
        { licensetype: 'FSSAI', number: 'QA-F-1', validto: day(365) },
      ],
    }), MGR);
    expect(v.status).toBeLessThan(300);
    const id = v.body.id;
    expect(v.body.licensestatus).toBe('EXPIRING');
    expect((await api.request('GET', '/vendors/licenses/expiring?days=60', undefined, MGR)).body.some((l: any) => l.vendor_id === id)).toBe(true);

    const renewed = await api.request('PUT', `/vendors/${id}`, {
      licenses: [
        { licensetype: 'WHOLESALE_20B_21B', number: 'QA-W-1', validto: day(20) },
        { licensetype: 'WHOLESALE_20B_21B', number: 'QA-W-2', validto: day(365) },
        { licensetype: 'FSSAI', number: 'QA-F-1', validto: day(365) },
      ],
    }, MGR);
    expect(renewed.body.licensestatus).toBe('VALID');
    expect((await api.request('GET', '/vendors/licenses/expiring?days=60', undefined, MGR)).body.some((l: any) => l.vendor_id === id)).toBe(false);

    expect((await api.request('PUT', `/vendors/${id}`, { licenses: [{ licensetype: 'OTHER', number: 'X', validfrom: day(10), validto: day(1) }] }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/vendors/${id}`, { licenses: [{ licensetype: 'OTHER', number: 'X' }, { licensetype: 'OTHER', number: 'x' }] }, MGR)).status).toBe(400);
  });

  test('VEND-9 the form shows what a GSTIN means and refuses a bad one @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/purchases/vendors/new');
    await expectShell(page);
    await page.getByTestId(TID.vendorFName).fill(`QA Form ${Date.now()}`);
    await page.getByTestId(TID.vendorFGstn).fill(breakCheck(randomGstin('33')));
    await expect(page.getByTestId('vendor-f-gstn-status')).toContainText('Not a valid GSTIN');
    await expect(page.getByTestId(TID.vendorFSubmit)).toBeDisabled();
    await page.getByTestId(TID.vendorFGstn).fill(randomGstin('33'));
    await expect(page.getByTestId('vendor-f-gstn-status')).toContainText('Tamil Nadu');
    await expect(page.getByTestId(TID.vendorFSubmit)).toBeEnabled();
    await page.getByTestId('vendor-f-lic-add').click();
    await expect(page.getByTestId('vendor-f-lic-row')).toHaveCount(1);
  });
});

test.describe('Vendor block and disable @p1', () => {
  const mk = () => ({ name: `QA BD ${Date.now()}-${Math.floor(Math.random() * 1e6)}` });
  const inList = async (api: any, id: number, status: string) =>
    (await api.request('GET', `/vendors?status=${status}`, undefined, MGR)).body.some((v: any) => v.id === id);

  test('VEND-11 a blocked vendor stays listed but takes no new orders, requests or invoices @happy', async ({ api }) => {
    const v = await api.request('POST', '/vendors', mk(), MGR);
    const id = v.body.id;
    expect((await api.request('POST', `/vendors/${id}/block`, {}, MGR)).status).toBe(400);          // a reason is required
    expect((await api.request('POST', `/vendors/${id}/block`, { reason: 'Drug licence expired' }, MGR)).status).toBeLessThan(300);

    const got = (await api.request('GET', `/vendors/${id}`, undefined, MGR)).body;
    expect(got.status).toBe('BLOCKED');
    expect(got.blockreason).toBe('Drug licence expired');
    expect(await inList(api, id, 'active')).toBe(true);
    expect(await inList(api, id, 'blocked')).toBe(true);
    expect(await inList(api, id, 'usable')).toBe(false);

    for (const [path, body] of [
      ['/purchaseorders', { vendorid: id }],
      ['/purchaserequests', { vendorid: id, qty: 5 }],
      ['/purchases', { vendorid: id, invoiceno: `QA-BD-${id}`, invoicedate: '2026-09-04' }],
    ] as const) {
      const r = await api.request('POST', path, body, MGR);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain('Drug licence expired');
    }

    expect((await api.request('POST', `/vendors/${id}/unblock`, undefined, MGR)).status).toBeLessThan(300);
    expect(await inList(api, id, 'usable')).toBe(true);
    expect((await api.request('POST', '/purchaseorders', { vendorid: id }, MGR)).status).toBeLessThan(300);
  });

  test('VEND-13 a disabled vendor leaves the lists, takes nothing new, and can be enabled @happy', async ({ api }) => {
    const v = await api.request('POST', '/vendors', mk(), MGR);
    const id = v.body.id;
    expect((await api.request('DELETE', `/vendors/${id}`, undefined, MGR)).status).toBeLessThan(300);
    expect(await inList(api, id, 'active')).toBe(false);
    expect(await inList(api, id, 'usable')).toBe(false);
    expect(await inList(api, id, 'disabled')).toBe(true);
    expect((await api.request('POST', '/purchaseorders', { vendorid: id }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/vendors/${id}/block`, { reason: 'should not work' }, MGR)).status).toBe(400);

    expect((await api.request('POST', `/vendors/${id}/enable`, undefined, MGR)).status).toBeLessThan(300);
    expect(await inList(api, id, 'active')).toBe(true);
    expect((await api.request('POST', '/purchaseorders', { vendorid: id }, MGR)).status).toBeLessThan(300);
  });

  test('VEND-15 block, unblock, disable and enable are written to the audit log @integration', async ({ api }) => {
    const v = await api.request('POST', '/vendors', mk(), MGR);
    const id = v.body.id;
    await api.request('POST', `/vendors/${id}/block`, { reason: 'Quality complaint' }, MGR);
    await api.request('POST', `/vendors/${id}/unblock`, undefined, MGR);
    await api.request('DELETE', `/vendors/${id}`, undefined, MGR);
    await api.request('POST', `/vendors/${id}/enable`, undefined, MGR);
    const log = await api.request('GET', `/audit?entitytype=vendors&entityid=${id}&limit=50`, undefined, MGR);
    const actions = log.body.rows.map((r: any) => r.action);
    for (const a of ['vendor.blocked', 'vendor.unblocked', 'vendor.disabled', 'vendor.enabled']) expect(actions).toContain(a);
    expect(log.body.rows.find((r: any) => r.action === 'vendor.blocked').details.reason).toBe('Quality complaint');
  });
});

test.describe('Vendor purchase figures @p1', () => {
  test('VEND-16 a vendor\'s figures match its invoice list, and the vendor filter returns only that vendor @integration', async ({ api }) => {
    const vendors = (await api.request('GET', '/vendors', undefined, MGR)).body;
    const v = vendors.find((x: any) => x.stats?.invoices > 0 && x.stats.invoices <= 150);
    test.skip(!v, 'no vendor with a manageable number of invoices in this data set');
    const list = await api.request('GET', `/purchases?page=1&limit=200&vendor=${v.id}`, undefined, MGR);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(list.body.total);
    expect(list.body.data.every((r: any) => r.vendor_id === v.id)).toBe(true);
    const done = list.body.data.filter((r: any) => r.status === 'COMPLETE');
    expect(done.length).toBe(v.stats.invoices);
    const latest = done.map((r: any) => String(r.invoice_date).slice(0, 10)).sort().pop();
    expect(latest).toBe(v.stats.lastpurchase);
    expect(Math.abs(done.reduce((t: number, r: any) => t + Number(r.total), 0) - v.stats.total)).toBeLessThan(1);
    // without the filter the list is wider than this vendor
    const all = await api.request('GET', '/purchases?page=1&limit=5', undefined, MGR);
    expect(all.body.total).toBeGreaterThanOrEqual(list.body.total);
  });
});
