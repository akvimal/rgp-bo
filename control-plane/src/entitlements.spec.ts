import { effectiveStatus, sign, verify } from './entitlements';
import { DEFAULT_PLANS, checkGrants, effectiveModules } from './plans';
import { SLUG, dbNameFor, schemaFiles } from './provision';
import { join } from 'path';

describe('entitlements', () => {
  const e: any = { slug: 'acme', plan: 'shop', planLabel: 'Shop', status: 'active', reason: null, trialEnds: null, modules: DEFAULT_PLANS[1].modules, limits: { stores: 1, users: 8 } };

  it('signs for one tenant only', () => {
    const t = sign(e, 'secret-a');
    expect(verify(t, 'secret-a').slug).toBe('acme');
    expect(() => verify(t, 'secret-b')).toThrow();
    expect(() => verify(t + 'x', 'secret-a')).toThrow();
  });

  it('reads an ended trial as suspended, an open one as is', () => {
    expect(effectiveStatus('trial', '2026-01-01', '2026-02-01')).toEqual({ status: 'suspended', reason: 'trial_ended' });
    expect(effectiveStatus('trial', '2026-03-01', '2026-02-01').status).toBe('trial');
    expect(effectiveStatus('active', '2020-01-01', '2026-02-01').status).toBe('active');
    expect(effectiveStatus('suspended', null).reason).toBe('suspended');
  });
});

describe('plans', () => {
  it('lays a customer\'s grants over the plan', () => {
    const starter = DEFAULT_PLANS[0].modules;
    expect(starter.gst).toBe(false);
    expect(effectiveModules(starter, { gst: true, purchasing: 'full' })).toMatchObject({ gst: true, purchasing: 'full' });
    expect(effectiveModules(DEFAULT_PLANS[2].modules, { hr: false }).hr).toBe(false);
  });

  it('keeps GST off when purchasing is off', () => {
    expect(effectiveModules(DEFAULT_PLANS[2].modules, { purchasing: 'off' }).gst).toBe(false);
  });

  it('checks grants', () => {
    expect(checkGrants({ gst: true }).value).toEqual({ gst: true });
    expect(checkGrants({ rockets: true }).error).toMatch(/Unknown/);
    expect(checkGrants({ gst: 'yes' }).error).toMatch(/Bad value/);
    expect(checkGrants({ purchasing: 'some' }).error).toMatch(/Bad value/);
  });
});

describe('provisioning names', () => {
  it('accepts safe tenant names only', () => {
    for (const ok of ['abc', 'sharma-pharmacy', 'a1b2c3']) expect(SLUG.test(ok)).toBe(true);
    for (const bad of ['ab', 'Abc', '1abc', 'a b', 'a;drop', 'a"b', 'x'.repeat(31)]) expect(SLUG.test(bad)).toBe(false);
    expect(dbNameFor('sharma-pharmacy')).toBe('rgp_sharma_pharmacy');
  });

  it('builds the schema from the repository files in order, the same set the QA stack applies', () => {
    const files = schemaFiles(join(__dirname, '..', '..', 'sql')).map((f) => f.split(/[\\/]/).slice(-1)[0]);
    expect(files.slice(0, 5)).toEqual(['001_sequences.sql', '002_tables.sql', '003_views.sql', '004_functions.sql', '005_seed.sql']);
    expect(files[5]).toBe('008_delivery_phase1.sql');
    expect(files).toContain('078_staffing_preset.sql');
    expect(files.some((f) => /rollback|^00[1-7]_add|028a/.test(f))).toBe(false);
    expect([...files.slice(5)].sort()).toEqual(files.slice(5));
  });
});

import { CAPS, documentLimits } from './entitlements';

describe('document and scan allowances', () => {
  it('holds demos and trials to their caps, whatever the plan allows', () => {
    expect(documentLimits({ is_demo: true, status: 'trial' }, {})).toEqual({ documents: CAPS.demo.documents, scans: CAPS.demo.scans });
    expect(documentLimits({ status: 'trial' }, {})).toEqual({ documents: CAPS.trial.documents, scans: CAPS.trial.scans });
    expect(documentLimits({ is_demo: true, status: 'trial' }, { max_documents: 5000, max_scans: 5000 })).toEqual({ documents: CAPS.demo.documents, scans: CAPS.demo.scans });
    expect(CAPS.demo.documents).toBeLessThan(CAPS.trial.documents);
  });

  it('never raises a plan\'s own smaller figure', () => {
    expect(documentLimits({ status: 'trial' }, { max_documents: 7, max_scans: 3 })).toEqual({ documents: 7, scans: 3 });
  });

  it('leaves a paying customer on the plan\'s figure, or unlimited', () => {
    expect(documentLimits({ status: 'active' }, {})).toEqual({ documents: null, scans: null });
    expect(documentLimits({ status: 'active' }, { max_documents: 500, max_scans: 100 })).toEqual({ documents: 500, scans: 100 });
  });

  it('lets a figure set on the customer win, even over a cap (the admin chose it)', () => {
    expect(documentLimits({ is_demo: true, status: 'trial', max_documents: 200, max_scans: 0 }, {})).toEqual({ documents: 200, scans: 0 });
  });
});
