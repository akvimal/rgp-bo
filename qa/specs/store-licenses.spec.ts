/**
 * Store drug licences and ship-to — STLIC-1..4
 * A drug licence belongs to the premises: each store carries its own, and a store whose drug licence has expired
 * cannot take in a new invoice.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function firstStore(api: any) {
  const stores = (await api.request('GET', '/stores', undefined, MGR)).body;
  expect(stores.length).toBeGreaterThan(0);
  return stores[0];
}

const keep = (before: any) => before.licenses.map((l: any) => ({ licensetype: l.licensetype, number: l.number, validfrom: l.validfrom, validto: l.validto, notes: l.notes }));

test.describe('Store licences @p1', () => {
  test('STLIC-1 licences and ship-to are saved, checked and audited; the store shows its status @happy', async ({ api }) => {
    const s = await firstStore(api);
    const before = (await api.request('GET', `/stores/${s.id}/licenses`, undefined, MGR)).body;
    try {
      const put = (body: any) => api.request('PUT', `/stores/${s.id}/licenses`, body, MGR);
      expect((await put({ pincode: '60' })).status).toBe(400);
      expect((await put({ licenses: [{ licensetype: 'NOPE', number: 'X1' }] })).status).toBe(400);
      expect((await put({ licenses: [{ licensetype: 'RETAIL_20_21', number: '' }] })).status).toBe(400);
      expect((await put({ licenses: [{ licensetype: 'RETAIL_20_21', number: 'A1', validfrom: day(10), validto: day(5) }] })).status).toBe(400);
      expect((await put({ licenses: [{ licensetype: 'RETAIL_20_21', number: 'A1' }, { licensetype: 'RETAIL_20_21', number: 'a1' }] })).status).toBe(400);

      const ok = await put({
        address: '12 QA Street', pincode: '600001', phone: '044 2345 6789',
        licenses: [{ licensetype: 'RETAIL_20_21', number: 'QA-RDL-1', validfrom: day(-300), validto: day(30) }, { licensetype: 'FSSAI', number: 'QA-FSSAI', validto: day(400) }],
      });
      expect(ok.status).toBeLessThan(300);
      expect(ok.body.licensestatus).toBe('EXPIRING');
      expect(ok.body.licenses.length).toBe(2);
      const listed = (await api.request('GET', '/stores', undefined, MGR)).body.find((x: any) => x.id === s.id);
      expect(listed.licensestatus).toBe('EXPIRING');
      const audit = await api.request('GET', `/audit?action=store.licenses_updated&entitytype=stores&entityid=${s.id}&limit=3`, undefined, MGR);
      expect(audit.body.rows.length).toBeGreaterThan(0);
    } finally {
      await api.request('PUT', `/stores/${s.id}/licenses`, { address: before.address ?? '', pincode: before.pincode ?? '', phone: before.phone ?? '', licenses: keep(before) }, MGR);
    }
  });

  test('STLIC-2 a renewal supersedes the old licence, and an expired drug licence blocks a new invoice @edge', async ({ api }) => {
    const s = await firstStore(api);
    const before = (await api.request('GET', `/stores/${s.id}/licenses`, undefined, MGR)).body;
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
    const put = (licenses: any[]) => api.request('PUT', `/stores/${s.id}/licenses`, { licenses }, MGR);
    try {
      expect((await put([{ licensetype: 'RETAIL_20_21', number: 'QA-OLD', validto: day(-20) }])).body.licensestatus).toBe('EXPIRED');
      const blocked = await api.request('POST', '/purchases', { vendorid: vendor.id, storeid: s.id, invoiceno: `QA-LIC-${Date.now()}`, invoicedate: day(0) }, MGR);
      expect(blocked.status).toBe(400);
      expect(JSON.stringify(blocked.body)).toContain('drug licence');
      const renewed = await put([{ licensetype: 'RETAIL_20_21', number: 'QA-OLD', validto: day(-20) }, { licensetype: 'RETAIL_20_21', number: 'QA-NEW', validto: day(300) }]);
      expect(renewed.body.licensestatus).toBe('VALID');
      const ok = await api.request('POST', '/purchases', { vendorid: vendor.id, storeid: s.id, invoiceno: `QA-LIC-${Date.now()}-b`, invoicedate: day(0) }, MGR);
      expect(ok.status).toBeLessThan(300);
    } finally {
      await api.request('PUT', `/stores/${s.id}/licenses`, { licenses: keep(before) }, MGR);
    }
  });

  test('STLIC-3 a store with no licence on file is not blocked, and only the Business Head can edit @negative', async ({ api }) => {
    const s = await firstStore(api);
    expect((await api.request('PUT', `/stores/${s.id}/licenses`, { licenses: [] }, SALES)).status).toBe(403);
    expect((await api.request('GET', `/stores/${s.id}/licenses`, undefined, SALES)).status).toBe(403);
    const before = (await api.request('GET', `/stores/${s.id}/licenses`, undefined, MGR)).body;
    try {
      expect((await api.request('PUT', `/stores/${s.id}/licenses`, { licenses: [] }, MGR)).body.licensestatus).toBe('NONE');
      const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
      const inv = await api.request('POST', '/purchases', { vendorid: vendor.id, storeid: s.id, invoiceno: `QA-LIC-${Date.now()}-n`, invoicedate: day(0) }, MGR);
      expect(inv.status).toBeLessThan(300);
    } finally {
      await api.request('PUT', `/stores/${s.id}/licenses`, { licenses: keep(before) }, MGR);
    }
  });

  test('STLIC-4 the address and licences of the chosen store are saved from the Details tab @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/settings/store');
    await expectShell(page);
    await page.getByTestId('store-s-tab-details').click();
    await expect(page.getByTestId('store-lic-panel')).toBeVisible();
    await expect(page.getByTestId('store-lic-status')).toBeVisible();
    const rows = await page.getByTestId('store-lic-row').count();
    await page.getByTestId('store-lic-add').click();
    await page.getByTestId('store-lic-number').last().fill('QA-UI-1');
    await page.getByTestId('store-lic-save').click();
    await expect(page.getByTestId('store-lic-message')).toContainText('saved');
    await expect(page.getByTestId('store-lic-row')).toHaveCount(rows + 1);
    // tidy up
    await page.getByTestId('store-lic-row').last().getByRole('button', { name: 'Remove' }).click();
    await page.getByTestId('store-lic-save').click();
    await expect(page.getByTestId('store-lic-message')).toContainText('saved');
  });
});
