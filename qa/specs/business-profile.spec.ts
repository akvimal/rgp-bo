/**
 * Business details managed by the Business Head — BIZ-1..3
 * The Site Admin creates the first business; after that the Business Head keeps its details current.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { breakCheck, randomGstin } from '../support/gstin.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const ADMIN = 'siteadmin@local.test';

test.describe('Business details @p1', () => {
  test('BIZ-1 the Business Head edits their own business; the GSTIN is checked and sets the state @happy', async ({ api }) => {
    const before = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
    expect(before.id).toBeTruthy();
    try {
      expect((await api.request('PUT', '/businesses/mine', { gstin: breakCheck(randomGstin('33')) }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/businesses/mine', { pincode: '60001' }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/businesses/mine', { name: ' ' }, MGR)).status).toBe(400);
      const g = randomGstin('33');
      const ok = await api.request('PUT', '/businesses/mine', { gstin: g.toLowerCase(), legalname: 'QA Legal Name', pincode: '600001', address: 'QA street' }, MGR);
      expect(ok.status).toBeLessThan(300);
      const after = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
      expect(after.gstin).toBe(g);
      expect(after.statecode).toBe('33');
      expect(after.legalname).toBe('QA Legal Name');
      const audit = await api.request('GET', `/audit?action=business.details_updated&entitytype=businesses&entityid=${before.id}&limit=3`, undefined, MGR);
      expect(audit.body.rows.length).toBeGreaterThan(0);
      // the GST readiness no longer asks for it
      const r = (await api.request('GET', `/gst/readiness?period=${new Date().toISOString().slice(0, 7)}`, undefined, MGR)).body;
      expect(r.business.gstin_valid).toBe(true);
      expect(r.issues.some((i: any) => i.code === 'BUSINESS_GSTIN' || i.code === 'BUSINESS_STATE')).toBe(false);
    } finally {
      await api.request('PUT', '/businesses/mine', { gstin: before.gstin ?? '', legalname: before.legalname ?? '', pincode: before.pincode ?? '', address: before.address ?? '', statecode: before.statecode ?? '' }, MGR);
    }
  });

  test('BIZ-2 only the Business Head reaches it, and the Businesses admin list stays with the Site Admin @negative', async ({ api }) => {
    expect((await api.request('GET', '/businesses/mine', undefined, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/businesses/mine', { legalname: 'x' }, SALES)).status).toBe(403);
    expect((await api.request('GET', '/businesses/mine', undefined, ADMIN)).status).toBe(403);
    expect((await api.request('GET', '/businesses', undefined, MGR)).status).toBe(403);
    expect((await api.request('POST', '/businesses', { name: 'Sneaky' }, MGR)).status).toBe(403);
    expect((await api.request('GET', '/businesses', undefined, ADMIN)).status).toBe(200);
  });

  test('BIZ-3 the Business details page saves the details and the menu shows it @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/settings/business-profile');
    await expectShell(page);
    await expect(page.getByTestId('biz-name')).toBeVisible();
    const original = await page.getByTestId('biz-legalname').inputValue();
    await page.getByTestId('biz-legalname').fill('QA Page Legal');
    await page.getByTestId('biz-save').click();
    await expect(page.getByTestId('biz-message')).toContainText('saved');
    await page.getByTestId('biz-legalname').fill(original);
    await page.getByTestId('biz-save').click();
    await expect(page.getByTestId('biz-message')).toContainText('saved');
  });
});
