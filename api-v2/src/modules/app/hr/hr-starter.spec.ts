import { itemsToAdd, STARTER, starterView, SUGGESTIONS } from './hr-starter';

describe('starter pay structure', () => {
  it('the starter set is the same for every kind of business and holds no statutory deduction', () => {
    const a = starterView('pharmacy', [], []).starter.map((i) => i.code);
    expect(a).toEqual(starterView('general', [], []).starter.map((i) => i.code));
    expect(a).toEqual(STARTER.map((i) => i.code));
    expect(a).not.toEqual(expect.arrayContaining(['PF']));
    expect(STARTER.filter((i) => i.kind === 'EARNING').length).toBeGreaterThan(0);
  });
  it('the pharmacist allowance is offered to a pharmacy only', () => {
    expect(starterView('pharmacy', [], []).suggestions.some((s) => s.code === 'PHARMACIST')).toBe(true);
    expect(starterView('general', [], []).suggestions.some((s) => s.code === 'PHARMACIST')).toBe(false);
  });
  it('marks what the business already has, by code', () => {
    const v = starterView('general', ['BASIC', 'DA'], ['CL']);
    expect(v.starter.find((i) => i.code === 'BASIC')!.have).toBe(true);
    expect(v.starter.find((i) => i.code === 'HRA')!.have).toBe(false);
    expect(v.starter.find((i) => i.code === 'CL')!.have).toBe(true);
    expect(v.suggestions.find((i) => i.code === 'DA')!.have).toBe(true);
  });
  it('every code is unique across the starter set and the suggestions', () => {
    const codes = [...STARTER, ...SUGGESTIONS].map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('what to add', () => {
  it('adds only what is missing, and nothing the second time', () => {
    const first = itemsToAdd('general', { starter: true }, ['BASIC'], ['CL']);
    expect(first.map((i) => i.code)).toEqual(['HRA', 'OTHERS', 'FIXED_DED', 'SL', 'EL', 'LWP']);
    expect(itemsToAdd('general', { starter: true }, ['BASIC', 'HRA', 'OTHERS', 'FIXED_DED'], ['CL', 'SL', 'EL', 'LWP'])).toEqual([]);
  });
  it('adds a suggestion only when asked for it, by code, in any case', () => {
    expect(itemsToAdd('general', { starter: true }, [], []).some((i) => i.code === 'PF')).toBe(false);
    expect(itemsToAdd('general', { codes: ['pf', 'ESI'] }, [], []).map((i) => i.code)).toEqual(['PF', 'ESI']);
  });
  it('skips unknown codes, a suggestion meant for another kind of business, and repeats', () => {
    expect(itemsToAdd('general', { codes: ['PHARMACIST', 'NOPE', 'PF', 'PF'] }, [], []).map((i) => i.code)).toEqual(['PF']);
    expect(itemsToAdd('pharmacy', { codes: ['PHARMACIST'] }, [], []).map((i) => i.code)).toEqual(['PHARMACIST']);
  });
  it('a suggestion sharing a code with a starter item is added once', () => {
    expect(itemsToAdd('general', { starter: true, codes: ['DA'] }, [], []).filter((i) => i.code === 'DA')).toHaveLength(1);
  });
});
