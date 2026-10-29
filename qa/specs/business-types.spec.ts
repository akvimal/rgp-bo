/**
 * Business types — BT-1..4
 * A business that is not a pharmacy has none of the pharmacy pack: no drug register, no refills, no medicine attributes or drug licences, no pharmacy words;
 * choosing the type is the business head's, only a known type is accepted, and switching back restores everything.
 * The QA business is flipped to "general" inside each test and always restored.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

async function asType(api: any, type: string, fn: () => Promise<void>) {
  const before = (await api.request('GET', '/businesses/mine', undefined, MGR)).body.businesstype || 'pharmacy';
  expect((await api.request('PUT', '/businesses/mine', { businesstype: type }, MGR)).status).toBeLessThan(300);
  // forget any saved choice for the pack's modules, so the type's own default is what is seen (a saved choice wins over the type)
  expect((await api.request('PUT', '/businesses/mine/modules', { drug_register: null, refills: null }, MGR)).status).toBeLessThan(300);
  try { await fn(); } finally { await api.request('PUT', '/businesses/mine', { businesstype: before }, MGR); }
}

test.describe('Business types @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('BT-1 a pharmacy gets the pharmacy configuration: its words, medicine attributes, prescription document and drug licences @happy', async ({ api }) => {
    await asType(api, 'pharmacy', async () => {
      const c = (await api.request('GET', '/packs/config', undefined, MGR)).body;
      expect(c.businessType).toBe('pharmacy');
      expect(c.packs).toContain('pharmacy');
      expect(c.labels.item).toBe('medicine');
      expect(c.productProps.map((p: any) => p.category)).toEqual(expect.arrayContaining(['Medicine', 'OTC']));
      expect(c.documentProps.map((d: any) => d.category)).toContain('Prescription');
      expect(c.licenceTypes.map((l: any) => l.code)).toContain('RETAIL_20_21');
      const mods = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
      expect(mods.drug_register).toBe(true);
      expect(mods.refills).toBe(true);
    });
  });

  test('BT-2 a general business has no pharmacy words, attributes, licences, modules or screens @negative', async ({ api }) => {
    await asType(api, 'general', async () => {
      const c = (await api.request('GET', '/packs/config', undefined, MGR)).body;
      expect(c.businessType).toBe('general');
      expect(c.packs).toEqual([]);
      expect(c.labels.item).toBe('item');
      expect(c.productProps).toEqual([]);
      expect(c.documentProps.map((d: any) => d.category)).not.toContain('Prescription');
      expect(c.licenceTypes.map((l: any) => l.code)).not.toContain('RETAIL_20_21');
      expect(JSON.stringify(c)).not.toMatch(/medicine|pharmac|prescription/i);

      const mods = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
      expect(mods.drug_register).toBe(false);
      expect(mods.refills).toBe(false);
      expect((await api.request('GET', '/schedule/register?from=2020-01-01&to=2099-12-31', undefined, MGR)).status).toBe(403);
      expect((await api.request('GET', '/refills', undefined, MGR)).status).toBe(403);

      const basic = (await api.request('GET', '/users/basic', undefined, MGR)).body;
      if (basic && basic.businesstype) { expect(basic.businesstype).toBe('general'); expect(basic.packs).toEqual([]); }
    });
  });

  test('BT-3 the type is the business head\'s to choose, and only a known type is accepted @negative', async ({ api }) => {
    const bad = await api.request('PUT', '/businesses/mine', { businesstype: 'rockets' }, MGR);
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
    const staff = await api.request('PUT', '/businesses/mine', { businesstype: 'general' }, SALES);
    expect([401, 403]).toContain(staff.status);
    const now = (await api.request('GET', '/businesses/mine', undefined, MGR)).body.businesstype || 'pharmacy';
    expect(['pharmacy', 'general']).toContain(now);
  });

  test('BT-4 a general business gets no pharmacy alerts, and switching back to a pharmacy restores the pack @edge', async ({ api }) => {
    await asType(api, 'general', async () => {
      const kinds = (await api.request('GET', '/alerts/kinds', undefined, MGR)).body.kinds as any[];
      const pharmacyKinds = kinds.filter((k) => k.pack === 'pharmacy').map((k) => k.kind);
      expect(pharmacyKinds.length).toBeGreaterThan(0);                                              // the catalogue knows which alerts are the pack's
      const rules = (await api.request('GET', '/alerts/rules', undefined, MGR)).body as any[];
      for (const k of pharmacyKinds) expect(rules.some((r) => r.kind === k && r.source === 'system')).toBe(false);
    });
    const mods = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
    expect(mods.drug_register).toBe(true);
    expect(mods.refills).toBe(true);
    expect((await api.request('GET', '/packs/config', undefined, MGR)).body.packs).toContain('pharmacy');
  });
});
