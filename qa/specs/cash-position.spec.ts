/**
 * Store cash balance and the vault — CASHPOS-1..2
 * The Store > Cash card and the dashboard's "Cash and shifts" tile show what the store holds: for a store with a vault, the cash in its drawers plus the cash in the
 * vault (plus anything waiting for confirmation), the same figure the vault page shows; for a store without one, its cash book. Cash dropped into the vault and cash
 * banked from it must not pull the balance down twice.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function freshStore(api: any, vault: boolean) {
  const location = `CashPos ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`;
  const s = await api.request('POST', '/stores', { location, depositthreshold: 5000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  if (vault) {
    const on = await api.request('PUT', `/stores/${s.body.id}`, { location, depositthreshold: 5000, vaultenabled: true, isActive: true }, MGR);
    expect(on.status, JSON.stringify(on.body)).toBeLessThan(300);
  }
  return s.body.id as number;
}
async function openShift(api: any, storeid: number) {
  const body = { storeid, openingcash: 0, allowZero: true };
  const first = await api.request('POST', '/store-cash/shifts', body, MGR);
  if (first.status !== 409 || !Array.isArray(first.body?.required)) return first;
  const compliancereasons = Object.fromEntries(first.body.required.map((r: any) => [r.id, 'qa spec: left for later']));
  return api.request('POST', '/store-cash/shifts', { ...body, compliancereasons }, MGR);
}
const dash = async (api: any, storeid: number) => (await api.request('GET', `/store-cash/dashboard?storeid=${storeid}`, undefined, MGR)).body;
const kpis = async (api: any, storeid: number) => (await api.request('GET', `/dashboard/summary?storeid=${storeid}`, undefined, MGR)).body.kpis;
const vaultOf = async (api: any, storeid: number) => (await api.request('GET', `/store-vault/${storeid}`, undefined, MGR)).body;

test.describe('Store cash and the vault @p1', () => {
  test('CASHPOS-1 a store with a vault: the cash balance is drawers + vault, on the cash page, the dashboard and the vault page, through a drop and a bank deposit @happy', async ({ api }) => {
    const sid = await freshStore(api, true);
    const opening = await api.request('POST', `/store-vault/${sid}/opening`, { denominations: [{ d: 500, n: 10 }] }, MGR);      // Rs 5,000 into the vault
    expect(opening.status, JSON.stringify(opening.body)).toBeLessThan(300);
    const shift = await openShift(api, sid);
    expect(shift.status, JSON.stringify(shift.body)).toBeLessThan(300);
    const dep = await api.request('POST', '/store-cash/ledger', { storeid: sid, shiftid: shift.body.id, category: 'ADJUSTMENT', deposit: 1000, description: 'qa takings' }, MGR);
    expect(dep.status, JSON.stringify(dep.body)).toBeLessThan(300);

    let d = await dash(api, sid);
    expect(d.position).toMatchObject({ vaultstores: 1, drawers: 1000, vault: 5000, waiting: 0 });
    expect(d.cashbalance).toBe(6000);
    expect((await vaultOf(api, sid)).balance).toBe(5000);

    // Rs 400 from the drawer into the vault: the total does not change, it moves
    const drop = await api.request('POST', `/store-vault/${sid}/drop-now`, { shiftid: shift.body.id, denominations: [{ d: 100, n: 4 }] }, MGR);
    expect(drop.status, JSON.stringify(drop.body)).toBeLessThan(300);
    d = await dash(api, sid);
    expect(d.position).toMatchObject({ drawers: 600, vault: 5400 });
    expect(d.cashbalance).toBe(6000);
    expect(d.cashbook).toBe(600);                                                                // the cash book alone would say 600: the vault's cash never entered it

    // Rs 2,000 from the vault to the bank: the total falls by that once
    const bank = await api.request('POST', `/store-vault/${sid}/deposit`, { denominations: [{ d: 500, n: 4 }], referenceno: 'QACP1' }, MGR);
    expect(bank.status, JSON.stringify(bank.body)).toBeLessThan(300);
    d = await dash(api, sid);
    expect(d.position).toMatchObject({ drawers: 600, vault: 3400 });
    expect(d.cashbalance).toBe(4000);
    expect(d.cashbook).toBe(-1400);                                                              // 1000 - 400 dropped - 2000 banked: not a balance of cash
    expect((await vaultOf(api, sid)).balance).toBe(3400);                                       // the vault page and the card agree

    // the dashboard tile says the same, in drawers, in the vault and in all
    const k = await kpis(api, sid);
    expect(k).toMatchObject({ cash_balance: 4000, cash_in_drawers: 600, cash_in_vault: 3400 });

    await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { counteddenominations: [{ d: 100, n: 6 }], countedcash: 600, closetype: 'HANDOVER', allowZero: true }, MGR);
  });

  test('CASHPOS-2 a store without a vault keeps the cash book as its balance @edge', async ({ api }) => {
    const sid = await freshStore(api, false);
    const shift = await openShift(api, sid);
    expect(shift.status, JSON.stringify(shift.body)).toBeLessThan(300);
    await api.request('POST', '/store-cash/ledger', { storeid: sid, shiftid: shift.body.id, category: 'ADJUSTMENT', deposit: 700, description: 'qa takings' }, MGR);
    const d = await dash(api, sid);
    expect(d.cashbalance).toBe(700);
    expect(d.cashbook).toBe(700);
    expect(d.position.vaultstores).toBe(0);
    expect((await kpis(api, sid)).cash_balance).toBe(700);
    await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { counteddenominations: [], allowZero: true }, MGR);
  });
});
