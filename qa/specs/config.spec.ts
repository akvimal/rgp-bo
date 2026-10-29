/**
 * Per-business settings - CFG-1..5
 * Everyone signed in reads the settings that apply to their business; only the Business Head changes them, from a date, inside the floor; the health weights
 * must add up to 100; a locked item cannot be changed; reset returns to the default; every change is audited.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

const item = (body: any, key: string) => body.items.find((x: any) => x.key === key);

test.describe.serial('CFG', () => {
  test.afterAll(async ({ api }) => {
    for (const s of ['compliance', 'recognition', 'health']) await api.request('DELETE', `/config/${s}`, undefined, MGR);
  });

  test('CFG-1 everyone reads the defaults of their business; only the Business Head can edit', async ({ api }) => {
    const m = await api.request('GET', '/config?scope=compliance', undefined, MGR);
    expect(m.status).toBe(200);
    expect(m.body.canEdit).toBe(true);
    expect(item(m.body, 'waiver_max_days')).toMatchObject({ value: 7, source: 'default' });
    const s = await api.request('GET', '/config?scope=compliance', undefined, SALES);
    expect(s.status).toBe(200);
    expect(s.body.canEdit).toBe(false);
    expect((await api.request('GET', '/config?scope=nope', undefined, MGR)).status).toBe(400);
  });

  test('CFG-2 a change begins on its date, inside the floor', async ({ api }) => {
    const bad = await api.request('PUT', '/config/compliance', { values: { stock_count_late_days: 40 } }, MGR);
    expect(bad.status).toBe(400);
    const past = await api.request('PUT', '/config/compliance', { values: { stock_count_late_days: 4 }, effectiveFrom: day(-1) }, MGR);
    expect(past.status).toBe(400);
    const ok = await api.request('PUT', '/config/compliance', { values: { stock_count_late_days: 4 } }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.effectiveFrom).toBe(day(1));
    // starts tomorrow, so today still shows the default
    expect(item((await api.request('GET', '/config?scope=compliance', undefined, MGR)).body, 'stock_count_late_days')).toMatchObject({ value: 3, source: 'default' });
    const now = await api.request('PUT', '/config/compliance', { values: { escalate_days: 5 }, effectiveFrom: day(0) }, MGR);
    expect(now.status).toBe(200);
    expect(item((await api.request('GET', '/config?scope=compliance', undefined, MGR)).body, 'escalate_days')).toMatchObject({ value: 5, source: 'business' });
  });

  test('CFG-3 only the Business Head changes settings; a store head and sales staff are refused', async ({ api }) => {
    expect((await api.request('PUT', '/config/compliance', { values: { escalate_days: 4 } }, HEAD)).status).toBe(403);
    expect((await api.request('PUT', '/config/recognition', { values: { till_streak: 8 } }, SALES)).status).toBe(403);
    expect((await api.request('DELETE', '/config/compliance', undefined, HEAD)).status).toBe(403);
  });

  test('CFG-4 the health weights must add up to 100, and locked items cannot change', async ({ api }) => {
    const bad = await api.request('PUT', '/config/health', { values: { w_sales: 30 }, effectiveFrom: day(0) }, MGR);
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toMatch(/add up to 105/);
    const ok = await api.request('PUT', '/config/health', { values: { w_sales: 20, w_compliance: 20 }, effectiveFrom: day(0) }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const locked = await api.request('PUT', '/config/compliance', { values: { drug_register: 'off' } }, MGR);
    expect(locked.status).toBe(400);
    expect(JSON.stringify(locked.body)).toMatch(/required/);
    expect(item((await api.request('GET', '/config?scope=compliance', undefined, MGR)).body, 'drug_register')).toMatchObject({ value: 'block', locked: true });
  });

  test('CFG-5 reset returns to the default and every change is audited', async ({ api }) => {
    const r = await api.request('DELETE', '/config/compliance/escalate_days', undefined, MGR);
    expect(r.status).toBe(200);
    expect(item((await api.request('GET', '/config?scope=compliance', undefined, MGR)).body, 'escalate_days')).toMatchObject({ value: 3, source: 'default' });
    const audit = await api.request('GET', '/audit?action=config.', undefined, MGR);
    expect(audit.status).toBe(200);
    expect(JSON.stringify(audit.body)).toMatch(/config\.(save|reset)/);
  });
});
