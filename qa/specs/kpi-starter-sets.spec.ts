/**
 * KPI starter sets and gates - KPI-ST-1..2
 * The Business Head previews the starter sets (nothing is written), and a gate has no points and is not accepted without a limit.
 * (docs/planning/KPI_MATRIX.md)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

test('KPI-ST-1 the starter sets are previewed without writing anything, and each adds up to 100 points', async ({ api }) => {
  const cat = await api.request('GET', '/hr/kpi/templates', undefined, MGR);
  expect(cat.status).toBe(200);
  expect(cat.body.sets.map((s: any) => s.position)).toEqual(['Sales Staff', 'Pharmacist', 'Store Head']);
  for (const s of cat.body.sets) { expect(s.points).toBe(100); expect(s.gates).toBeGreaterThanOrEqual(2); }

  const before = (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.length;
  const preview = await api.request('POST', '/hr/kpi/templates/apply', {}, MGR);
  expect(preview.status).toBeLessThan(300);
  expect(preview.body.written).toBe(false);
  expect(preview.body.sets).toHaveLength(3);
  expect((await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.length).toBe(before);
});

test('KPI-ST-2 a gate has no points and is not accepted without a limit', async ({ api }) => {
  const bad = await api.request('POST', '/hr/kpi/metrics', { name: `QA gate ${Date.now()}`, source: 'SYSTEM', system_key: 'CASH_VARIANCE', is_gate: true, rule: { kind: 'gate' } }, MGR);
  expect(bad.status).toBe(400);
  const ok = await api.request('POST', '/hr/kpi/metrics', { name: `QA gate ${Date.now()}`, source: 'SYSTEM', system_key: 'CASH_VARIANCE', is_gate: true, rule: { kind: 'gate', limit: 1000 } }, MGR);
  expect(ok.status).toBeLessThan(300);
  const list = (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body;
  const made = list.find((m: any) => m.id === ok.body.id);
  expect(made).toMatchObject({ is_gate: true, max_points: 0 });
  await api.request('DELETE', `/hr/kpi/metrics/${ok.body.id}`, undefined, MGR);
});
