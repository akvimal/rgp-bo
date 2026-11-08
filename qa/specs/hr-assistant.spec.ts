/**
 * The AI key card, the monthly request limit and usage log, which model does which job, and the HR Role assistant — AIA-1..6.
 * AIA-1..3 need no model. AIA-4..6 need the stand-in model (qa/support/ai-standin.mjs) and an API started against it; set QA_AI_STANDIN=1 to run them.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';
const STANDIN = !!process.env.QA_AI_STANDIN;

test.describe.configure({ mode: 'serial' });

test.describe('AI key, usage and the Role assistant @p1', () => {
  test('AIA-1 the key, its usage and its limit belong to the Business Head alone @negative', async ({ api }) => {
    for (const who of [STOREHEAD, COUNTER]) {
      expect((await api.request('GET', '/alerts/ai', undefined, who)).status, `${who} reads the key settings`).toBe(403);
      expect((await api.request('GET', '/alerts/ai/usage', undefined, who)).status).toBe(403);
      expect((await api.request('PUT', '/alerts/ai/limit', { limit: 5 }, who)).status).toBe(403);
      expect((await api.request('PUT', '/alerts/ai/key', { provider: 'anthropic', key: 'sk-ant-should-not-work-000000' }, who)).status).toBe(403);
      expect((await api.request('DELETE', '/alerts/ai/key', undefined, who)).status).toBe(403);
      expect((await api.request('POST', '/alerts/ai/test', {}, who)).status).toBe(403);
      expect((await api.request('PUT', '/alerts/ai/models', { default: 'claude-haiku-5-5' }, who)).status).toBe(403);
    }
    for (const who of [STOREHEAD, COUNTER]) {
      expect((await api.request('GET', '/hr/ai/status', undefined, who)).status, 'the Role assistant is HR, so Business Head only').toBe(403);
      expect((await api.request('POST', '/hr/ai/role/draft', { position_id: 1 }, who)).status).toBe(403);
    }
    expect((await api.request('GET', '/alerts/ai/usage', undefined, MGR)).status).toBe(200);
  });

  test('AIA-2 a bad key or a bad limit is refused, and the key is never shown back @negative', async ({ api }) => {
    expect((await api.request('PUT', '/alerts/ai/key', { provider: 'anthropic', key: 'short' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/alerts/ai/key', { provider: 'nowhere', key: 'sk-ant-0123456789abcdef0123' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/alerts/ai/key', { provider: 'anthropic', key: 'sk-ant 0123456789 abcdef0123' }, MGR)).status).toBe(400);   // spaces inside
    for (const bad of [-1, 2.5, 'lots', '', 100001, null]) {
      expect((await api.request('PUT', '/alerts/ai/limit', { limit: bad }, MGR)).status, `limit ${JSON.stringify(bad)}`).toBe(400);
    }
    const before = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body.limit;
    expect(Number.isInteger(before)).toBe(true);
    const cfg = (await api.request('GET', '/alerts/ai', undefined, MGR)).body;
    expect(JSON.stringify(cfg)).not.toMatch(/sk-ant|sk-or-/);                       // only the last few characters are ever returned
  });

  test('AIA-3 the key card shows the month and saves a limit from the screen @happy', async ({ app, api }) => {
    const before = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body;
    const { page } = await app.open(MGR, '/secure/settings/business-profile/ai');
    await expectShell(page);
    await expect(page.getByTestId('aik-card')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('aik-usage')).toBeVisible();
    await expect(page.getByTestId('aik-used')).toContainText('request');
    try {
      await page.getByTestId('aik-limit').fill('4');
      await page.getByTestId('aik-limit-save').click();
      await expect(page.getByTestId('aik-message')).toContainText('Limit saved');
      expect((await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body.limit).toBe(4);
      await expect(page.getByTestId('aik-used')).toContainText('of 4');
      await page.getByTestId('aik-limit').fill('-3');
      await page.getByTestId('aik-limit-save').click();
      await expect(page.getByTestId('aik-error')).toBeVisible();
    } finally {
      await api.request('PUT', '/alerts/ai/limit', { limit: before.limit }, MGR);
    }
  });

  test('AIA-4 every request is counted with its tokens, and the limit stops the assistants until it is raised @happy', async ({ api }) => {
    test.skip(!STANDIN, 'needs the stand-in model: see qa/support/ai-standin.mjs');
    const original = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body;
    try {
      const startUsed = original.used;
      await api.request('PUT', '/alerts/ai/limit', { limit: startUsed + 2 }, MGR);
      const t1 = await api.request('POST', '/alerts/ai/test', {}, MGR);
      expect([t1.status, t1.body.ok]).toEqual([201, true]);
      const u1 = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body;
      expect(u1.used).toBe(startUsed + 1);
      const row = u1.by_feature.find((f: any) => f.label === 'Connection tests');
      expect(row.input_tokens).toBeGreaterThan(0);
      expect(row.output_tokens).toBeGreaterThan(0);
      expect((await api.request('POST', '/alerts/ai/test', {}, MGR)).status).toBe(201);
      const u2 = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body;
      expect(u2.state).toBe('reached');
      // refused before anything is sent, for every assistant, and not counted
      const refused = await api.request('POST', '/alerts/ai/test', {}, MGR);
      expect(refused.status).toBe(503);
      expect(JSON.stringify(refused.body)).toMatch(/limit of \d+ requests/);
      const roleDraft = await api.request('POST', '/hr/ai/role/draft', { position_id: (await api.request('GET', '/hr/positions', undefined, MGR)).body.slice(-1)[0].id }, MGR);
      expect(roleDraft.status).toBe(503);
      expect((await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body.used).toBe(startUsed + 2);
      // 0 lifts the limit
      await api.request('PUT', '/alerts/ai/limit', { limit: 0 }, MGR);
      expect((await api.request('POST', '/alerts/ai/test', {}, MGR)).status).toBe(201);
    } finally {
      await api.request('PUT', '/alerts/ai/limit', { limit: original.limit }, MGR);
    }
  });

  test('AIA-5 the Role assistant drafts a job role, KPIs and incentive bands that the Business Head approves step by step @happy', async ({ app, api }) => {
    test.skip(!STANDIN, 'needs the stand-in model: see qa/support/ai-standin.mjs');
    const original = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body;
    await api.request('PUT', '/alerts/ai/limit', { limit: 0 }, MGR);
    const name = 'QA assistant role ' + Date.now() % 100000;
    const add = await api.request('POST', '/hr/positions', { name }, MGR);
    expect(add.status).toBeLessThan(300);
    const id = (await api.request('GET', '/hr/positions', undefined, MGR)).body.find((p: any) => p.name === name).id;
    // the assistant works from the people who hold the role, so one person holds it for the test
    const staff = (await api.request('GET', '/hr/staff', undefined, MGR)).body.find((s: any) => s.email === 'sales2@local.test');
    expect(staff, 'sales2 is an HR staff record (the attendance specs add it)').toBeTruthy();
    const was = staff.position_id ?? null;
    expect((await api.request('PUT', `/hr/staff/${staff.id}`, { position_id: id }, MGR)).status).toBeLessThan(300);
    try {
      const { page } = await app.open(MGR, '/secure/hr/assistant');
      await expectShell(page);
      await page.getByTestId('as-role').filter({ hasText: name }).getByTestId('as-open').click();

      await page.getByTestId('as-step1').click();
      await page.getByTestId('as-draft-role').click();
      await expect(page.getByTestId('as-purpose')).not.toHaveValue('', { timeout: 20_000 });
      expect(await page.getByTestId('as-resp').count()).toBeGreaterThanOrEqual(3);
      await page.getByTestId('as-save-role').click();
      await expect(page.getByTestId('as-message')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('as-error')).toHaveCount(0);
      const saved = (await api.request('GET', '/hr/ai/roles', undefined, MGR)).body.find((r: any) => r.id === id);
      expect(String(saved.purpose).length).toBeGreaterThan(10);
      expect(saved.responsibilities.length).toBeGreaterThanOrEqual(3);

      await page.getByTestId('as-step2').click();
      await page.getByTestId('as-draft-kpis').click();
      await expect(page.getByTestId('as-kpi').first()).toBeVisible({ timeout: 20_000 });
      // an invented measure is never accepted as a system measure: the drafts are checked on the server
      await page.getByTestId('as-apply-kpis').click();
      await expect(page.getByTestId('as-message')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('as-error')).toHaveCount(0);

      await page.getByTestId('as-step3').click();
      await page.getByTestId('as-draft-bands').click();
      await expect(page.getByTestId('as-band').first()).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('as-apply-bands').click();
      await expect(page.getByTestId('as-message')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('as-error')).toHaveCount(0);

      await page.getByTestId('as-step4').click();
      await page.getByTestId('as-todos').click();
      await expect(page.getByTestId('as-message')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('as-error')).toHaveCount(0);
    } finally {
      await api.request('PUT', `/hr/staff/${staff.id}`, { position_id: was }, MGR);
      await api.request('DELETE', `/hr/positions/${id}`, undefined, MGR);
      await api.request('PUT', '/alerts/ai/limit', { limit: original.limit }, MGR);
    }
  });

  test('AIA-6 each assistant uses its own model, else its level, else the default, and the choices are checked @happy', async ({ app, api }) => {
    test.skip(!STANDIN, 'needs the stand-in model: see qa/support/ai-standin.mjs');
    const last = async () => (await fetch('http://localhost:3911/last')).json();
    const original = (await api.request('GET', '/alerts/ai', undefined, MGR)).body;
    const usage = (await api.request('GET', '/alerts/ai/usage', undefined, MGR)).body;
    await api.request('PUT', '/alerts/ai/limit', { limit: 0 }, MGR);
    const name = 'QA model role ' + Date.now() % 100000;
    expect((await api.request('POST', '/hr/positions', { name }, MGR)).status).toBeLessThan(300);
    const id = (await api.request('GET', '/hr/positions', undefined, MGR)).body.find((p: any) => p.name === name).id;
    const staff = (await api.request('GET', '/hr/staff', undefined, MGR)).body.find((s: any) => s.email === 'sales2@local.test');
    expect(staff).toBeTruthy();
    const was = staff.position_id ?? null;
    await api.request('PUT', `/hr/staff/${staff.id}`, { position_id: id }, MGR);
    const clear = { default: '', tiers: { simple: '', standard: '', complex: '' }, tasks: { propose_bands: '', propose_kpis: '', propose_role: '', propose_alert_rule: '', propose_checklist_items: '', reply: '' } };
    try {
      await api.request('PUT', '/alerts/ai/models', clear, MGR);
      const cfg = (await api.request('GET', '/alerts/ai', undefined, MGR)).body;
      expect(cfg.tiers.map((t: any) => t.tier)).toEqual(['simple', 'standard', 'complex']);
      expect(cfg.tasks.map((t: any) => t.task)).toEqual(expect.arrayContaining(['propose_alert_rule', 'propose_checklist_items', 'propose_role', 'propose_kpis', 'propose_bands']));
      expect(cfg.models.map((m: any) => m.id)).toEqual(expect.arrayContaining(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']));
      for (const t of cfg.tasks) expect(t.uses, `${t.task} has a model in use`).toBeTruthy();

      // the choices are checked
      expect((await api.request('PUT', '/alerts/ai/models', { tiers: { huge: 'claude-haiku-5-5' } }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/alerts/ai/models', { tasks: { nope: 'claude-haiku-5-5' } }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/alerts/ai/models', { default: 'two words' }, MGR)).status).toBe(400);
      const unknown = await api.request('PUT', '/alerts/ai/models', { tiers: { simple: 'no-such-model' } }, MGR);
      expect(unknown.status).toBe(400);
      expect(JSON.stringify(unknown.body)).toMatch(/not one of the choices/);
      expect((await api.request('GET', '/alerts/ai', undefined, MGR)).body.tiers.find((t: any) => t.tier === 'simple').model).toBe('');   // nothing was half-saved

      // default sonnet; simple jobs haiku; complex jobs opus; incentive bands their own
      const saved = await api.request('PUT', '/alerts/ai/models', { default: 'claude-sonnet-5-5', tiers: { simple: 'claude-haiku-5-5', complex: 'claude-opus-5-5' }, tasks: { propose_bands: 'claude-sonnet-5-5' } }, MGR);
      expect(saved.status).toBeLessThan(300);
      const uses = (task: string) => saved.body.tasks.find((t: any) => t.task === task);
      expect([uses('propose_alert_rule').uses, uses('propose_alert_rule').source]).toEqual(['claude-haiku-5-5', 'tier']);
      expect([uses('propose_role').uses, uses('propose_role').source]).toEqual(['claude-sonnet-5-5', 'default']);
      expect([uses('propose_kpis').uses, uses('propose_kpis').source]).toEqual(['claude-opus-5-5', 'tier']);
      expect([uses('propose_bands').uses, uses('propose_bands').source]).toEqual(['claude-sonnet-5-5', 'task']);

      // and the requests really go to those models
      expect((await api.request('POST', '/alerts/ai/test', {}, MGR)).status).toBe(201);
      expect((await last()).model).toBe('claude-haiku-5-5');
      const role = await api.request('POST', '/hr/ai/role/draft', { position_id: id }, MGR);
      expect(role.status).toBeLessThan(300);
      expect((await last()).model).toBe('claude-sonnet-5-5');
      // the KPIs come from an approved description
      expect((await api.request('POST', '/hr/ai/role/save', { position_id: id, purpose: role.body.draft.purpose, responsibilities: role.body.draft.responsibilities }, MGR)).status).toBeLessThan(300);
      expect((await api.request('POST', '/hr/ai/kpis/draft', { position_id: id }, MGR)).status).toBeLessThan(300);
      expect((await last()).model).toBe('claude-opus-5-5');
      expect((await api.request('POST', '/alerts/rules/draft', { instruction: 'Tell the store heads when a shift stays open more than 12 hours' }, MGR)).status).toBeLessThan(500);
      expect((await last()).model).toBe('claude-haiku-5-5');

      // a job's own model beats its level's
      await api.request('PUT', '/alerts/ai/models', { tasks: { propose_kpis: 'claude-haiku-5-5' } }, MGR);
      expect((await api.request('POST', '/hr/ai/kpis/draft', { position_id: id }, MGR)).status).toBeLessThan(300);
      expect((await last()).model).toBe('claude-haiku-5-5');

      // from the screen
      const { page } = await app.open(MGR, '/secure/settings/business-profile/ai');
      await expectShell(page);
      await expect(page.getByTestId('aim-card')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('aim-task-model-propose_kpis').fill('');
      await expect(page.getByTestId('aim-uses-propose_kpis')).toContainText('claude-opus-5-5');   // follows its level again, before saving
      await expect(page.getByTestId('aim-save')).toBeEnabled();
      await page.getByTestId('aim-tier-model-standard').fill('claude-opus-5-5');
      await expect(page.getByTestId('aim-uses-propose_role')).toContainText('claude-opus-5-5');
      await page.getByTestId('aim-save').click();
      await expect(page.getByTestId('aim-message')).toBeVisible();
      const after = (await api.request('GET', '/alerts/ai', undefined, MGR)).body;
      expect(after.tiers.find((t: any) => t.tier === 'standard').model).toBe('claude-opus-5-5');
      expect(after.tasks.find((t: any) => t.task === 'propose_kpis').model).toBe('');
      // a model that does not exist is refused with its reason
      await page.getByTestId('aim-tier-model-simple').fill('no-such-model');
      await page.getByTestId('aim-save').click();
      await expect(page.getByTestId('aim-error')).toContainText('not one of the choices');
    } finally {
      await api.request('PUT', `/hr/staff/${staff.id}`, { position_id: was }, MGR);
      await api.request('DELETE', `/hr/positions/${id}`, undefined, MGR);
      await api.request('PUT', '/alerts/ai/models', { ...clear, default: original.chosen ? original.model : '' }, MGR);
      await api.request('PUT', '/alerts/ai/limit', { limit: usage.limit }, MGR);
    }
  });
});
