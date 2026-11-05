import { cleanCategoryKind, fallsIn, levelProblem, offered, rollUpByGroup } from './expense-category-rules';

describe('where a category may be booked', () => {
  it('a store-only category needs a store', () => {
    expect(levelProblem('Water', 'STORE', null)).toContain('choose the store');
    expect(levelProblem('Water', 'STORE', 3)).toBeNull();
  });
  it('a business-only category takes no store', () => {
    expect(levelProblem('Insurance', 'BUSINESS', 3)).toContain('leave the store empty');
    expect(levelProblem('Insurance', 'BUSINESS', null)).toBeNull();
  });
  it('a category for both is allowed either way (rent, electricity)', () => {
    expect(levelProblem('Rent', 'BOTH', null)).toBeNull();
    expect(levelProblem('Rent', 'BOTH', 3)).toBeNull();
  });
});

describe('the pick list', () => {
  const cats = [{ name: 'Water', level: 'STORE' }, { name: 'Insurance', level: 'BUSINESS' }, { name: 'Rent', level: 'BOTH' }];
  it('at a store: store and both', () => expect(offered(cats, 5).map((c) => c.name)).toEqual(['Water', 'Rent']));
  it('at business level: business and both', () => expect(offered(cats, null).map((c) => c.name)).toEqual(['Insurance', 'Rent']));
});

describe('what the setup page may send', () => {
  it('keeps what is not changed', () => expect(cleanCategoryKind({}, { level: 'STORE', cost_group: 'Premises' })).toEqual({ level: 'STORE', cost_group: 'Premises' }));
  it('starts a new category as both / other', () => expect(cleanCategoryKind({})).toEqual({ level: 'BOTH', cost_group: 'Other' }));
  it('takes a new level and group', () => expect(cleanCategoryKind({ level: 'BUSINESS', cost_group: 'Marketing' })).toEqual({ level: 'BUSINESS', cost_group: 'Marketing' }));
  it('refuses what is not one of them', () => {
    expect(() => cleanCategoryKind({ level: 'REGION' })).toThrow(/store, business or both/);
    expect(() => cleanCategoryKind({ cost_group: 'Fun' })).toThrow(/Group is one of/);
  });
});

describe('the report by group', () => {
  it('rolls categories up by group, biggest first', () => {
    const out = rollUpByGroup([
      { category: 'Rent', group: 'Premises', amount: 20000, gst: 0 },
      { category: 'Water', group: 'Premises', amount: 500.5, gst: 50 },
      { category: 'Water', group: 'Premises', amount: 200.25, gst: 0 },
      { category: 'Marketing', group: 'Marketing', amount: 3000, gst: 540 },
    ]);
    expect(out.map((g) => g.name)).toEqual(['Premises', 'Marketing']);
    expect(out[0]).toMatchObject({ amount: 20700.75, gst: 50 });
    expect(out[0].categories).toEqual([{ name: 'Rent', amount: 20000 }, { name: 'Water', amount: 700.75 }]);
  });
});

describe('a repeating expense that is not monthly', () => {
  it('monthly falls in every month from its start', () => {
    expect(fallsIn('2026-03', '2026-03', 1)).toBe(true);
    expect(fallsIn('2026-03', '2026-04', 1)).toBe(true);
    expect(fallsIn('2026-03', '2026-02', 1)).toBe(false);
  });
  it('quarterly and yearly count from the first month', () => {
    expect(fallsIn('2026-02', '2026-05', 3)).toBe(true);
    expect(fallsIn('2026-02', '2026-04', 3)).toBe(false);
    expect(fallsIn('2026-11', '2027-11', 12)).toBe(true);
    expect(fallsIn('2026-11', '2027-10', 12)).toBe(false);
    expect(fallsIn('2025-12', '2026-06', 6)).toBe(true);
  });
});
