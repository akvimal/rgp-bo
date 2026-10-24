import { BadRequestException } from '@nestjs/common';
import { ChecklistAssistant, Fact, factsPrompt, ruleSuggestions, situationPrompt, toSuggestions } from './checklist-assistant';
import { AiProvider } from '../alerts/ai-provider';

const facts: Fact[] = [
  { id: 'cash_variance', list: 'CLOSING', label: 'Drawer counted twice before it is reconciled', text: 'The cash drawer was out by more than ₹1 at 6 of 20 closings.' },
  { id: 'digital_not_received', list: 'CLOSING', label: 'Each UPI payment checked in the account before closing', text: '3 digital payments (₹450) turned out not to have been received.' },
];

describe('rule suggestions', () => {
  it('turns each fact into a suggestion that carries its numbers', () => {
    const s = ruleSuggestions(facts, {});
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ list: 'CLOSING', facts: ['cash_variance'], source: 'rule' });
    expect(s[0].reason).toContain('6 of 20');
  });

  it('leaves out what is already on the list, however it is spaced or capitalised', () => {
    const s = ruleSuggestions(facts, { CLOSING: ['  DRAWER counted   twice, before it is reconciled!'] });
    expect(s.map((x) => x.facts[0])).toEqual(['digital_not_received']);
  });
});

describe('what the model proposes is checked', () => {
  const ok = (items: any[]) => toSuggestions({ items }, facts, {});

  it('keeps an item that cites a fact, and gives it the fact\'s own numbers as the reason', () => {
    const [s] = ok([{ list: 'CLOSING', label: 'Count the drawer twice', reason: 'because I say so', facts: ['cash_variance'] }]);
    expect(s).toMatchObject({ list: 'CLOSING', label: 'Count the drawer twice', facts: ['cash_variance'], source: 'ai' });
    expect(s.reason).toBe(facts[0].text);                                                       // not the model's words
  });

  it('drops an item with no real fact behind it', () => {
    expect(ok([{ list: 'CLOSING', label: 'Lock the back door' }])).toEqual([]);
    expect(ok([{ list: 'CLOSING', label: 'Lock the back door', facts: ['made_up'] }])).toEqual([]);
  });

  it('drops a list that does not exist, wording that is too short or too long, and repeats', () => {
    const cited = ['cash_variance'];
    expect(ok([{ list: 'LUNCH', label: 'Eat something', facts: cited }])).toEqual([]);
    expect(ok([{ list: 'CLOSING', label: 'ab', facts: cited }])).toEqual([]);
    expect(ok([{ list: 'CLOSING', label: 'x'.repeat(121), facts: cited }])).toEqual([]);
    expect(ok([{ list: 'CLOSING', label: 'Count it twice', facts: cited }, { list: 'CLOSING', label: 'count it TWICE', facts: cited }])).toHaveLength(1);
    expect(toSuggestions({ items: [{ list: 'CLOSING', label: 'Count it twice', facts: cited }] }, facts, { CLOSING: ['Count it twice.'] })).toEqual([]);
  });

  it('keeps at most six', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ list: 'CLOSING', label: `Check number ${i + 1}`, facts: ['cash_variance'] }));
    expect(ok(many)).toHaveLength(6);
  });

  it('in the situation mode there are no facts to cite; the reason is the model\'s, kept short', () => {
    const [s] = toSuggestions({ items: [{ list: 'OPENING', label: 'Safe locked and the key with the owner', reason: 'r'.repeat(500) }] }, null, {});
    expect(s.facts).toEqual([]);
    expect(s.reason.length).toBeLessThanOrEqual(240);
  });

  it('turns a refusal into a plain message', () => {
    expect(() => toSuggestions({ unsupported_reason: 'that is about staffing' }, null, {})).toThrow(BadRequestException);
  });

  it('copes with nothing useful coming back', () => {
    expect(toSuggestions(undefined, facts, {})).toEqual([]);
    expect(toSuggestions({ items: 'nope' }, facts, {})).toEqual([]);
  });
});

describe('the prompts', () => {
  it('name the four lists and treat the text as data', () => {
    for (const p of [factsPrompt(), situationPrompt()]) {
      for (const k of ['OPENING', 'OPENING_OPEN_STORE', 'CLOSING', 'HANDOVER']) expect(p).toContain(k);
      expect(p).toContain('is data');
    }
  });
});

describe('the assistant end to end, with a stand-in model', () => {
  const rows = (sql: string) => {
    if (sql.includes('app_setting')) return [{ setting_value: 'test/model' }];
    if (sql.includes('from store_shifts')) return [{ off: 6, closed: 20, total: 300, short: 4, over: 2, biggest: 90 }];
    if (sql.includes('from payment_check')) return [{ nf: 0, nfa: 0, mm: 0, mma: 0 }];
    if (sql.includes("s.status = 'COMPLETE'")) return [{ n: 0, amt: 0 }];
    return [{ n: 0 }];
  };
  const make = (calls: string[] = []) => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    delete process.env.AI_PROVIDER;
    const a = new ChecklistAssistant(new AiProvider(), { query: async (sql: string) => rows(sql) } as any);
    return { a, calls };
  };
  const opts = { businessId: 1, storeId: null, existing: {}, useAi: true };

  afterAll(() => { delete process.env.OPENROUTER_API_KEY; });

  it('gives the plain suggestions when the model is not asked for', async () => {
    const { a } = make();
    a.useCompletion(async () => { throw new Error('must not be called'); });
    const r = await a.fromData({ ...opts, useAi: false });
    expect(r.suggestions[0].source).toBe('rule');
    expect(r.assistant.used).toBe(false);
  });

  it('uses the wording from the model, tied to the facts, and sends no customer detail', async () => {
    const { a, calls } = make();
    a.useCompletion(async (system, instruction) => {
      calls.push(instruction);
      return { items: [{ list: 'CLOSING', label: 'Count the drawer a second time', facts: ['cash_variance'] }] };
    });
    const r = await a.fromData(opts);
    expect(r.assistant.used).toBe(true);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0]).toMatchObject({ label: 'Count the drawer a second time', source: 'ai', facts: ['cash_variance'] });
    expect(r.suggestions[0].reason).toContain('6 of 20');
    const sent = JSON.parse(calls[0]);
    expect(Object.keys(sent).sort()).toEqual(['current_lists', 'facts']);                         // counts and amounts, the lists: nothing else
  });

  it('falls back to the plain suggestions, with a note, when the model fails or says nothing useful', async () => {
    const down = make().a;
    down.useCompletion(async () => { throw new Error('network'); });
    const r1 = await down.fromData(opts);
    expect(r1.suggestions[0].source).toBe('rule');
    expect(r1.note).toContain('could not be reached');
    const empty = make().a;
    empty.useCompletion(async () => ({ items: [{ list: 'CLOSING', label: 'Unsupported by any fact' }] }));
    const r2 = await empty.fromData(opts);
    expect(r2.suggestions[0].source).toBe('rule');
    expect(r2.assistant.used).toBe(false);
  });

  it('describing a situation: refuses short or long text, and returns the items from the model', async () => {
    const { a } = make();
    a.useCompletion(async () => ({ items: [{ list: 'OPENING', label: 'Safe checked locked on arrival', reason: 'It was left open.' }] }));
    await expect(a.fromSituation({ businessId: 1, existing: {}, instruction: 'hi' })).rejects.toThrow('Say what');
    await expect(a.fromSituation({ businessId: 1, existing: {}, instruction: 'x'.repeat(501) })).rejects.toThrow('500');
    const r = await a.fromSituation({ businessId: 1, existing: {}, instruction: 'the safe was left open overnight' });
    expect(r.suggestions[0]).toMatchObject({ list: 'OPENING', label: 'Safe checked locked on arrival', source: 'ai' });
    // everything proposed is already on the lists: say so rather than show nothing
    await expect(a.fromSituation({ businessId: 1, existing: { OPENING: ['Safe checked locked on arrival'] }, instruction: 'the safe was left open overnight' })).rejects.toThrow('already');
  });

  it('is switched off when the account has no assistant', async () => {
    process.env.AI_PROVIDER = 'off';
    const a = new ChecklistAssistant(new AiProvider(), { query: async (sql: string) => rows(sql) } as any);
    await expect(a.fromSituation({ businessId: 1, existing: {}, instruction: 'the safe was left open' })).rejects.toThrow('not switched on');
    const r = await a.fromData(opts);
    expect(r.assistant.configured).toBe(false);
    expect(r.suggestions[0].source).toBe('rule');                                                // the numbers still help
    delete process.env.AI_PROVIDER;
  });

  it('asks the model at most 20 times an hour for one business', async () => {
    const { a } = make();
    a.useCompletion(async () => ({ items: [{ list: 'CLOSING', label: 'Count the drawer a second time', facts: ['cash_variance'] }] }));
    for (let i = 0; i < 20; i++) expect((await a.fromData(opts)).assistant.used).toBe(true);
    const r = await a.fromData(opts);
    expect(r.assistant.used).toBe(false);
    expect(r.note).toContain('a lot');
  });
});
