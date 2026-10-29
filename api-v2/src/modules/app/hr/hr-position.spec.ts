import { hasEarning, normaliseLines } from './hr-position';

describe('pay structure lines', () => {
  it('keeps positive amounts once per component, rounded to the paisa, and drops the rest', () => {
    expect(normaliseLines([{ component_id: 1, amount: '15000' }, { component_id: 2, amount: 0 }, { component_id: 3, amount: -5 }, { component_id: 4, amount: 'x' }, { component_id: 1, amount: 16000.456 }]))
      .toEqual([{ component_id: 1, amount: 16000.46 }]);
  });
  it('is empty for anything that is not a list', () => {
    expect(normaliseLines(null)).toEqual([]);
    expect(normaliseLines({})).toEqual([]);
    expect(normaliseLines([{ amount: 5 }, { component_id: 1.5, amount: 5 }])).toEqual([]);
  });
  it('needs at least one earning', () => {
    const kinds = { 1: 'EARNING', 2: 'DEDUCTION' };
    expect(hasEarning([{ component_id: 1, amount: 5 }], kinds)).toBe(true);
    expect(hasEarning([{ component_id: 2, amount: 5 }], kinds)).toBe(false);
    expect(hasEarning([], kinds)).toBe(false);
  });
});
