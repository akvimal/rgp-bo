import { choicesFrom, parseChanges, pickModel, TASKS, TIERS } from './ai-models';

const rows = (o: Record<string, string | null>) => Object.entries(o).map(([setting_key, setting_value]) => ({ setting_key, setting_value }));

describe('which model does which job', () => {
  it('uses the server default when nothing is chosen', () => {
    expect(pickModel(choicesFrom([]), 'propose_kpis', 'srv-model')).toEqual({ model: 'srv-model', source: 'server' });
  });

  it('uses the default model the Business Head chose', () => {
    const c = choicesFrom(rows({ 'ai.model': 'm-default' }));
    expect(pickModel(c, 'propose_kpis', 'srv')).toEqual({ model: 'm-default', source: 'default' });
  });

  it('uses the model of the job\'s level before the default', () => {
    const c = choicesFrom(rows({ 'ai.model': 'm-default', 'ai.model.tier.complex': 'm-big', 'ai.model.tier.simple': 'm-small' }));
    expect(pickModel(c, 'propose_kpis', 'srv')).toEqual({ model: 'm-big', source: 'tier' });          // complex
    expect(pickModel(c, 'propose_alert_rule', 'srv')).toEqual({ model: 'm-small', source: 'tier' });  // simple
    expect(pickModel(c, 'propose_role', 'srv')).toEqual({ model: 'm-default', source: 'default' });   // standard has none
  });

  it('uses a job\'s own model before its level\'s', () => {
    const c = choicesFrom(rows({ 'ai.model': 'm-default', 'ai.model.tier.complex': 'm-big', 'ai.model.task.propose_kpis': 'm-special' }));
    expect(pickModel(c, 'propose_kpis', 'srv')).toEqual({ model: 'm-special', source: 'task' });
    expect(pickModel(c, 'propose_bands', 'srv').model).toBe('m-default');
  });

  it('ignores empty values and names it does not know', () => {
    const c = choicesFrom(rows({ 'ai.model': '', 'ai.model.tier.simple': '  ', 'ai.model.tier.huge': 'x', 'ai.model.task.nope': 'x', 'ai.model.task.propose_role': null }));
    expect(c).toEqual({ default: '', tiers: {}, tasks: {} });
  });

  it('puts every job in a level that exists, and names each once', () => {
    expect(new Set(TASKS.map((t) => t.task)).size).toBe(TASKS.length);
    for (const t of TASKS) expect(TIERS.map((x) => x.tier)).toContain(t.tier);
  });
});

describe('a save of the model choices', () => {
  it('reads the default, the levels and the jobs, and lets any of them be cleared', () => {
    expect(parseChanges({ default: 'a/b', tiers: { simple: 'c', complex: '' }, tasks: { propose_kpis: 'd' } }))
      .toEqual({ changes: { default: 'a/b', tiers: { simple: 'c', complex: '' }, tasks: { propose_kpis: 'd' } } });
    expect(parseChanges({})).toEqual({ changes: { tiers: {}, tasks: {} } });
  });

  it('refuses a level or job it does not know, and a value that is not a model name', () => {
    expect('error' in parseChanges({ tiers: { huge: 'x' } })).toBe(true);
    expect('error' in parseChanges({ tasks: { nope: 'x' } })).toBe(true);
    expect('error' in parseChanges({ default: 'two words' })).toBe(true);
    expect('error' in parseChanges({ default: 5 })).toBe(true);
    expect('error' in parseChanges({ tasks: { propose_kpis: 'x'.repeat(200) } })).toBe(true);
  });
});
