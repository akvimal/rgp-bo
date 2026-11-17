/**
 * The bank deposit slip (challan) with a vault deposit - RVS-1..4.
 * It is uploaded with the reference number when cash is banked from the vault, or added when the slip arrives; it follows the deposit into the cash book row;
 * only a file uploaded for a deposit slip is accepted.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const API = () => process.env.QA_API_URL as string;
// a one-pixel PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function slipUpload(api: any, store: number, type = 'image/png', name = 'slip.png', folder = 'bankdeposit'): Promise<string> {
  const f = new FormData();
  f.append('file', new Blob([PNG], { type }), name);
  const r = await fetch(`${API()}/files/upload?${folder}=${store}-${Date.now()}`, { method: 'POST', headers: { authorization: `Bearer ${await api.token(MGR)}` }, body: f });
  const body = await r.json();
  expect(r.status, JSON.stringify(body)).toBeLessThan(300);
  return body.path as string;
}

async function vaultStore(api: any) {
  const location = `Slip ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`;
  const s = await api.request('POST', '/stores', { location, depositthreshold: 5000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  const on = await api.request('PUT', `/stores/${s.body.id}`, { location, depositthreshold: 5000, vaultenabled: true, isActive: true }, MGR);
  expect(on.status, JSON.stringify(on.body)).toBeLessThan(300);
  const op = await api.request('POST', `/store-vault/${s.body.id}/opening`, { denominations: [{ d: 500, n: 20 }] }, MGR);
  expect(op.status, JSON.stringify(op.body)).toBeLessThan(300);
  return { id: s.body.id as number, location };
}
const movements = async (api: any, id: number) => (await api.request('GET', `/store-vault/${id}/movements`, undefined, MGR)).body as any[];
const ledger = async (api: any, id: number) => (await api.request('GET', `/store-cash/ledger?storeid=${id}`, undefined, MGR)).body as any[];

test.describe('Vault deposit slip @p1', () => {
  test('RVS-1 a deposit made with a slip keeps it on the movement and on its cash book row @happy', async ({ api }) => {
    const s = await vaultStore(api);
    const path = await slipUpload(api, s.id);
    const dep = await api.request('POST', `/store-vault/${s.id}/deposit`, { denominations: [{ d: 500, n: 4 }], referenceno: 'QASLIP1', receiptpath: path }, MGR);
    expect(dep.status, JSON.stringify(dep.body)).toBeLessThan(300);
    const mv = (await movements(api, s.id)).find((m) => m.movetype === 'BANK_DEPOSIT_OUT');
    expect(mv).toMatchObject({ referenceno: 'QASLIP1', receiptpath: path });
    const row = (await ledger(api, s.id)).find((e: any) => e.category === 'BANK_DEPOSIT');
    expect(row, 'the cash book row').toBeTruthy();
    expect(row.receiptpath).toBe(path);
    // the file can be read back
    const view = await fetch(`${API()}/files/view`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await api.token(MGR)}` }, body: JSON.stringify({ path }) });
    expect(view.status).toBeLessThan(300);
  });

  test('RVS-2 the slip is optional, and can be added, replaced and taken off afterwards; the cash book row follows @integration', async ({ api }) => {
    const s = await vaultStore(api);
    const dep = await api.request('POST', `/store-vault/${s.id}/deposit`, { denominations: [{ d: 500, n: 2 }], referenceno: 'QASLIP2' }, MGR);
    expect(dep.status).toBeLessThan(300);
    const id = String(dep.body.id);
    expect((await movements(api, s.id)).find((m) => m.id === id).receiptpath).toBeNull();
    const first = await slipUpload(api, s.id);
    expect((await api.request('POST', `/store-vault/movements/${id}/receipt`, { receiptpath: first }, MGR)).status).toBeLessThan(300);
    expect((await movements(api, s.id)).find((m) => m.id === id).receiptpath).toBe(first);
    expect((await ledger(api, s.id)).find((e: any) => e.category === 'BANK_DEPOSIT').receiptpath).toBe(first);
    const second = await slipUpload(api, s.id, 'application/pdf', 'slip.pdf');
    await api.request('POST', `/store-vault/movements/${id}/receipt`, { receiptpath: second }, MGR);
    expect((await movements(api, s.id)).find((m) => m.id === id).receiptpath).toBe(second);
    await api.request('POST', `/store-vault/movements/${id}/receipt`, { receiptpath: '' }, MGR);
    expect((await movements(api, s.id)).find((m) => m.id === id).receiptpath).toBeNull();
    expect((await ledger(api, s.id)).find((e: any) => e.category === 'BANK_DEPOSIT').receiptpath).toBeNull();
  });

  test('RVS-3 only a file uploaded as a deposit slip is accepted, and only for a bank deposit @negative', async ({ api }) => {
    const s = await vaultStore(api);
    const expense = await slipUpload(api, s.id, 'image/png', 'bill.png', 'expense');                  // uploaded for something else
    expect((await api.request('POST', `/store-vault/${s.id}/deposit`, { denominations: [{ d: 500, n: 1 }], receiptpath: expense }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/store-vault/${s.id}/deposit`, { denominations: [{ d: 500, n: 1 }], receiptpath: '/etc/passwd' }, MGR)).status).toBeGreaterThanOrEqual(400);
    expect((await api.request('POST', `/store-vault/${s.id}/deposit`, { denominations: [{ d: 500, n: 1 }], receiptpath: 'bankdeposit/none/not-there.png' }, MGR)).status).toBeGreaterThanOrEqual(400);
    expect((await movements(api, s.id)).filter((m) => m.movetype === 'BANK_DEPOSIT_OUT').length).toBe(0);        // nothing was banked by the refused ones
    // a drop or an opening has no slip
    const opening = (await movements(api, s.id)).find((m) => m.movetype === 'OPENING');
    const path = await slipUpload(api, s.id);
    expect((await api.request('POST', `/store-vault/movements/${opening.id}/receipt`, { receiptpath: path }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/store-vault/movements/999999999/receipt`, { receiptpath: path }, MGR)).status).toBe(404);
  });

  test('RVS-4 on the vault screen: attach the slip while banking, see it in the history, add one to an older deposit @happy', async ({ app, api }) => {
    const s = await vaultStore(api);
    // an older deposit with no slip
    await api.request('POST', `/store-vault/${s.id}/deposit`, { denominations: [{ d: 500, n: 1 }], referenceno: 'QAOLD' }, MGR);
    const { page } = await app.open(MGR, '/secure/store/vault', { storeId: s.id });
    // the QA database has hundreds of stores: choose this one in the header if the page did not keep the choice
    await page.getByTestId('store-switcher').selectOption(String(s.id));
    await expect(page.getByTestId('vault-history')).toContainText('QAOLD');                    // the page has finished loading before the panel is opened
    await page.getByTestId('vault-act-deposit').click();
    await page.getByTestId('vault-ref').fill('QASCREEN');
    await page.getByTestId('vault-slip-file').setInputFiles({ name: 'challan.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('vault-slip-attached')).toContainText('challan.png');
    await page.getByTestId('denom-500').fill('2');
    await page.getByTestId('vault-submit').click();
    await expect(page.getByTestId('vault-message')).toContainText('Deposit recorded');
    // the history: the new deposit has its slip, the older one offers to add one
    const mine = page.getByTestId('vault-history').locator('tr').filter({ hasText: 'QASCREEN' });
    await expect(mine.getByTestId('vault-slip-view')).toBeVisible();
    const old = page.getByTestId('vault-history').locator('tr').filter({ hasText: 'QAOLD' });
    await expect(old.getByTestId('vault-slip-view')).toHaveCount(0);
    await old.getByTestId('vault-slip-add').setInputFiles({ name: 'late.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('vault-message')).toContainText('The deposit slip is saved');
    await expect(old.getByTestId('vault-slip-view')).toBeVisible();
    expect((await movements(api, s.id)).filter((m) => m.movetype === 'BANK_DEPOSIT_OUT' && m.receiptpath).length).toBe(2);
    // taking it off
    await old.getByTestId('vault-slip-remove').click();
    await expect(page.getByTestId('vault-message')).toContainText('taken off');
    await expect(old.getByTestId('vault-slip-view')).toHaveCount(0);
  });

  test('RVS-5 a bank deposit entered on the Cash page keeps its slip too, from the same upload area only @integration', async ({ api }) => {
    const loc = `Slip cash ${Date.now()}`;
    const st = await api.request('POST', '/stores', { location: loc, depositthreshold: 5000, isActive: true }, MGR);
    expect(st.status).toBeLessThan(300);
    const id = st.body.id as number;
    const path = await slipUpload(api, id);
    const ok = await api.request('POST', '/store-cash/ledger', { storeid: id, category: 'BANK_DEPOSIT', withdraw: 1000, referenceno: 'QACASH1', description: 'qa deposit', receiptpath: path }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const row = (await ledger(api, id)).find((e: any) => e.category === 'BANK_DEPOSIT');
    expect(row).toMatchObject({ referenceno: 'QACASH1', receiptpath: path });
    const bad = await slipUpload(api, id, 'image/png', 'b.png', 'expense');
    const refused = await api.request('POST', '/store-cash/ledger', { storeid: id, category: 'BANK_DEPOSIT', withdraw: 500, referenceno: 'QACASH2', description: 'qa deposit', receiptpath: bad }, MGR);
    expect(refused.status).toBe(400);
    expect((await ledger(api, id)).filter((e: any) => e.category === 'BANK_DEPOSIT').length).toBe(1);
  });
});
