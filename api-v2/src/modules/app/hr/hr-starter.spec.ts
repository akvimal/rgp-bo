import { pickRoleSuggestions, roleSuggestions, checkDecision, itemsToAdd, payrollMode, rolesToAdd, STARTER_BY_MODE, starterView, statutoryProgress, statutoryView, suggestionsFor } from './hr-starter';

describe('payroll mode follows how the business is registered', () => {
  it('limited companies are compliance; everything else, and anything unknown, is lite', () => {
    expect(payrollMode('PRIVATE_LIMITED')).toBe('COMPLIANCE');
    expect(payrollMode('PUBLIC_LIMITED')).toBe('COMPLIANCE');
    for (const f of ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'OTHER', '', null, undefined, 'WHATEVER']) expect(payrollMode(f as any)).toBe('LITE');
  });
});

describe('starter pay structure', () => {
  it('the lite set follows a proprietor\'s own payroll sheet and holds no statutory deduction', () => {
    const lite = starterView('pharmacy', [], [], 'LITE').starter.map((i) => i.code);
    expect(lite).toEqual(['BASIC', 'DA', 'OTHERS', 'FIXED_DED', 'CL', 'SL', 'EL', 'LWP']);
    expect(lite).not.toEqual(expect.arrayContaining(['PF']));
    expect(starterView('general', [], [], 'LITE').starter.map((i) => i.code)).toEqual(lite);
  });
  it('the compliance set adds the statutory deductions and the usual allowances, and all of the lite set', () => {
    const lite = STARTER_BY_MODE.LITE.map((i) => i.code);
    const full = STARTER_BY_MODE.COMPLIANCE.map((i) => i.code);
    for (const c of lite) expect(full).toContain(c);
    for (const c of ['PF', 'ESI', 'PT', 'TDS', 'HRA', 'SPECIAL', 'ML']) expect(full).toContain(c);
  });
  it('what a mode starts with is not offered again as a suggestion, so nothing is listed twice', () => {
    for (const mode of ['LITE', 'COMPLIANCE'] as const) {
      const codes = [...STARTER_BY_MODE[mode], ...suggestionsFor(mode)].map((i) => i.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
    expect(suggestionsFor('LITE').some((s) => s.code === 'PF')).toBe(true);
    expect(suggestionsFor('COMPLIANCE').some((s) => s.code === 'PF')).toBe(false);
  });
  it('the pharmacist allowance is offered to a pharmacy only', () => {
    expect(starterView('pharmacy', [], []).suggestions.some((s) => s.code === 'PHARMACIST')).toBe(true);
    expect(starterView('general', [], []).suggestions.some((s) => s.code === 'PHARMACIST')).toBe(false);
  });
  it('marks what the business already has, by code', () => {
    const v = starterView('general', ['BASIC', 'HRA'], ['CL']);
    expect(v.starter.find((i) => i.code === 'BASIC')!.have).toBe(true);
    expect(v.starter.find((i) => i.code === 'DA')!.have).toBe(false);
    expect(v.starter.find((i) => i.code === 'CL')!.have).toBe(true);
    expect(v.suggestions.find((i) => i.code === 'HRA')!.have).toBe(true);
  });
});

describe('what to add', () => {
  it('adds only what is missing, and nothing the second time', () => {
    const first = itemsToAdd('general', { starter: true }, ['BASIC'], ['CL']);
    expect(first.map((i) => i.code)).toEqual(['DA', 'OTHERS', 'FIXED_DED', 'SL', 'EL', 'LWP']);
    expect(itemsToAdd('general', { starter: true }, ['BASIC', 'DA', 'OTHERS', 'FIXED_DED'], ['CL', 'SL', 'EL', 'LWP'])).toEqual([]);
  });
  it('moving to compliance later adds only what the lite set did not have', () => {
    const have = STARTER_BY_MODE.LITE.filter((i) => i.kind !== 'LEAVE').map((i) => i.code);
    const haveLeave = STARTER_BY_MODE.LITE.filter((i) => i.kind === 'LEAVE').map((i) => i.code);
    expect(itemsToAdd('general', { starter: true }, have, haveLeave, 'COMPLIANCE').map((i) => i.code)).toEqual(['HRA', 'SPECIAL', 'PF', 'ESI', 'PT', 'TDS', 'ML']);
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

describe('statutory decisions', () => {
  it('a yes or a no must be given, and a no needs a reason', () => {
    expect('error' in checkDecision('PF', {})).toBe(true);
    expect('error' in checkDecision('PF', { applies: 'yes' })).toBe(true);
    expect('error' in checkDecision('PF', { applies: false, reason: ' ' })).toBe(true);
    expect(checkDecision('pf', { applies: false, reason: 'Fewer than 20 employees' })).toEqual({ value: { code: 'PF', applies: false, reason: 'Fewer than 20 employees', reg_no: null } });
  });
  it('a yes keeps the registration number (upper case) only for items that have one', () => {
    expect(checkDecision('PF', { applies: true, reg_no: ' tn/chn/123 ', reason: 'ignored' })).toEqual({ value: { code: 'PF', applies: true, reason: null, reg_no: 'TN/CHN/123' } });
    expect(checkDecision('GRATUITY', { applies: true, reg_no: 'X1' })).toEqual({ value: { code: 'GRATUITY', applies: true, reason: null, reg_no: null } });
    expect(checkDecision('PF', { applies: false, reason: 'Not needed', reg_no: 'X' })).toEqual({ value: { code: 'PF', applies: false, reason: 'Not needed', reg_no: null } });
  });
  it('rejects an unknown item and over-long text', () => {
    expect('error' in checkDecision('NOPE', { applies: true })).toBe(true);
    expect('error' in checkDecision('PF', { applies: true, reg_no: 'x'.repeat(41) })).toBe(true);
    expect('error' in checkDecision('PF', { applies: false, reason: 'x'.repeat(201) })).toBe(true);
  });
  it('shows every item, undecided until answered, and counts what is answered and what lacks a registration number', () => {
    expect(statutoryView([]).every((r) => r.applies === null)).toBe(true);
    const d = [{ code: 'PF', applies: true, reason: null, reg_no: null }, { code: 'ESI', applies: false, reason: 'Fewer than 10', reg_no: null }, { code: 'TDS', applies: true, reason: null, reg_no: 'CHNA12345B' }];
    expect(statutoryProgress(d)).toEqual({ decided: 3, total: 6, missing_reg: ['PF'] });
  });
});

describe('starter job roles', () => {
  it('offers the shop roles to every business and the pharmacist to a pharmacy only', () => {
    expect(rolesToAdd('general', []).map((r) => r.name)).toEqual(['Store manager', 'Sales staff']);
    expect(rolesToAdd('pharmacy', []).map((r) => r.name)).toEqual(['Store manager', 'Sales staff', 'Pharmacist']);
  });
  it('leaves out the ones that exist already, by name in any case, so a second press adds nothing', () => {
    expect(rolesToAdd('pharmacy', ['store MANAGER', ' Sales staff ', 'Pharmacist'])).toEqual([]);
  });
  it('carries the usual login role as a hint only', () => {
    expect(rolesToAdd('general', []).map((r) => r.login_role)).toEqual(['Store Head', 'Sales Staff']);
  });
});

describe('suggested job roles', () => {
  it('offers the extra roles the business does not have, by name in any case', () => {
    expect(roleSuggestions([]).map((r) => r.name)).toEqual(['Assistant manager', 'Cashier', 'Delivery', 'Accountant', 'Helper']);
    expect(roleSuggestions(['cashier ', 'HELPER']).map((r) => r.name)).toEqual(['Assistant manager', 'Delivery', 'Accountant']);
  });
  it('adds only the ones asked for, only from the list, once each, and none the business has', () => {
    expect(pickRoleSuggestions(['cashier', 'Cashier', 'Pilot', ' helper '], []).map((r) => r.name)).toEqual(['Cashier', 'Helper']);
    expect(pickRoleSuggestions(['Cashier'], ['Cashier'])).toEqual([]);
    expect(pickRoleSuggestions('Cashier', [])).toEqual([]);
    expect(pickRoleSuggestions(undefined, [])).toEqual([]);
  });
});
