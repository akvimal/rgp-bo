/**
 * Expiry revamp, the three small items — EXX-1..3
 * An approved out-pass that nobody confirms raises an alert; the Drug register has a Disposals tab for scheduled drugs that left through a pass;
 * "Move" on the Expiry screen opens the transfer with the batch already chosen.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

const lastMonth = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d.toISOString().slice(0, 10); };

async function freshStore(api: any) {
  const location = `Exx ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`;
  const s = await api.request('POST', '/stores', { location, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return { id: s.body.id as number, location };
}
async function batch(api: any, storeid: number, qty: number, exp: string, extra: Record<string, any> = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA EXX ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `EX${stamp}`, ...extra }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body.find((x: any) => x.isActive !== false && !x.blocked);
  const inv = await api.request('POST', '/purchases', { vendorid: v.id, storeid, invoiceno: `QA-EXX-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: 100, ptrcost: 112, mrpcost: 200, taxpcnt: 12, total: qty * 100, batch: `EX-${stamp}`.slice(0, 20), expdate: exp, saleprice: 190,
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  return { itemid: it.body.id as number, productid: prod.body.id as number, title: prod.body.title as string };
}
const makePass = async (api: any, storeid: number, itemid: number, qty: number, approve = true) => {
  const p = await api.request('POST', '/disposal', { storeid, reason: 'EXPIRED', method: 'DESTROYED', lines: [{ itemid, qty }] }, MGR);
  expect(p.status, JSON.stringify(p.body)).toBeLessThan(300);
  if (approve) await api.request('POST', `/disposal/${p.body.id}/approve`, undefined, MGR);
  return p.body;
};

test.describe('Expiry: alert, register tab, move @p1', () => {
  test('EXX-1 an approved out-pass that has waited raises an alert that clears when it is confirmed @happy', async ({ api }) => {
    const s = await freshStore(api);
    const b = await batch(api, s.id, 5, lastMonth());
    const pass = await makePass(api, s.id, b.itemid, 2);
    // the built-in alert waits 3 days; a rule for 0 days catches a pass approved just now
    const rule = await api.request('POST', '/alerts/rules', { kind: 'disposal_unconfirmed', params: { days: 0 } }, MGR);
    expect(rule.status, JSON.stringify(rule.body)).toBeLessThan(300);
    expect((await api.request('POST', '/alerts/rules', { kind: 'disposal_unconfirmed', params: { days: 99 } }, MGR)).status).toBe(400);   // within its limits

    await api.request('POST', '/alerts/run', {}, MGR);
    const mine = (await api.request('GET', '/alerts/notifications?status=open&limit=200', undefined, MGR)).body.items.filter((n: any) => n.code === 'disposal_unconfirmed' && n.store === s.location);
    expect(mine.length).toBe(1);
    expect(mine[0].link).toContain(`/secure/store/stock/passes/${pass.id}`);

    await api.request('POST', `/disposal/${pass.id}/confirm`, {}, MGR);
    await api.request('POST', '/alerts/run', {}, MGR);
    const after = (await api.request('GET', '/alerts/notifications?status=open&limit=200', undefined, MGR)).body.items.filter((n: any) => n.code === 'disposal_unconfirmed' && n.store === s.location);
    expect(after.length).toBe(0);                                                                // confirmed: nothing waiting any more
    await api.request('DELETE', `/alerts/rules/${rule.body.id}`, undefined, MGR);
  });

  test('EXX-2 the Drug register has a Disposals tab: a scheduled drug confirmed on an out-pass is there, in its own numbering, linked to the pass @happy', async ({ app, api }) => {
    const s = await freshStore(api);
    const b = await batch(api, s.id, 6, lastMonth(), { props: { schedule: 'H1' } });
    const pass = await makePass(api, s.id, b.itemid, 4);
    const conf = await api.request('POST', `/disposal/${pass.id}/confirm`, {}, MGR);
    expect(conf.status, JSON.stringify(conf.body)).toBeLessThan(300);

    const reg = (await api.request('GET', `/schedule/disposals?storeid=${s.id}`, undefined, MGR)).body;
    expect(reg.rows.length).toBe(1);
    expect(reg.rows[0]).toMatchObject({ schedule: 'H1', qty: 4, pass_no: pass.pass_no, drug_name: b.title });
    expect(reg.rows[0].label).toMatch(/^D-H1-\d{4}$/);
    expect(reg.totals.H1).toMatchObject({ lines: 1, units: 4 });

    const { page } = await app.open(MGR, '/secure/schedule-register');
    await page.getByTestId('dr-tab-disposals').click();
    await expect(page.getByTestId('dr-disposals')).toBeVisible();
    const row = page.getByTestId('dr-d-row').filter({ hasText: b.title });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(reg.rows[0].label);
    await expect(row.getByTestId('dr-d-pass')).toHaveText(pass.pass_no);
  });

  test('EXX-3 Move on the Expiry screen opens a transfer with that batch and its quantity chosen @happy', async ({ app, api }) => {
    const s = await freshStore(api);
    const b = await batch(api, s.id, 7, lastMonth());
    const { page } = await app.open(MGR, '/secure/store/stock/expiry');
    await page.getByRole('combobox', { name: 'Select store' }).selectOption(String(s.id));
    const line = page.getByTestId('expiry-row').filter({ hasText: b.title });
    await expect(line).toHaveCount(1);
    await line.getByTestId('expiry-move').click();

    await expect(page).toHaveURL(/\/secure\/store\/transfers/);
    await expect(page.getByTestId('transfer-product')).toContainText(b.title);                  // the dialog is open with the product named
    await expect(page.locator('p-dialog input[type=number]')).toHaveValue('7');                 // and the quantity that can go
    await expect(page.getByText('Available: 7')).toBeVisible();
  });
});
