import { payHistory } from './hr-pay-history';

const L = (component_id: number, name: string, amount: number, kind = 'EARNING') => ({ component_id, name, kind, amount });

describe('a person\'s pay history', () => {
  const revs = [
    { id: 1, effective_from: '2025-04-01', lines: [L(1, 'Base salary', 12000), L(2, 'DA', 1000)] },
    { id: 2, effective_from: '2026-04-01', lines: [L(1, 'Base salary', 13000), L(2, 'DA', 1000), L(3, 'Misc', 500)] },
    { id: 3, effective_from: '2027-04-01', lines: [L(1, 'Base salary', 14000), L(2, 'DA', 1000), L(3, 'Misc', 500)] },
  ];
  it('the pay in force is the latest revision not after today; later ones are upcoming', () => {
    const h = payHistory(revs, '2026-10-30');
    expect(h.current?.id).toBe(2);
    expect(h.current?.gross).toBe(14500);
    expect(h.upcoming.map((s) => s.id)).toEqual([3]);
    expect(h.history.map((s) => s.id)).toEqual([2, 1]);
  });
  it('a change is the difference from the revision before: raised, added or dropped', () => {
    const h = payHistory([...revs, { id: 4, effective_from: '2026-08-01', lines: [L(1, 'Base salary', 13000), L(3, 'Misc', 500)] }], '2026-10-30');
    const step = h.history.find((s) => s.id === 2)!;
    expect(step.changes).toEqual([{ name: 'Base salary', kind: 'EARNING', from: 12000, to: 13000 }, { name: 'Misc', kind: 'EARNING', from: null, to: 500 }]);
    const aug = h.history.find((s) => s.id === 4)!;
    expect(aug.changes).toEqual([{ name: 'DA', kind: 'EARNING', from: 1000, to: null }]);
  });
  it('the first revision has no changes, deductions are kept apart from earnings, and nothing yet is nothing', () => {
    const h = payHistory([{ id: 9, effective_from: '2026-01-01', lines: [L(1, 'Base salary', 10000), L(7, 'Other deductions', 250, 'DEDUCTION')] }], '2026-10-30');
    expect(h.current?.changes).toEqual([]);
    expect(h.current?.gross).toBe(10000);
    expect(h.current?.deductions).toBe(250);
    expect(payHistory([], '2026-10-30')).toEqual({ current: null, upcoming: [], history: [] });
  });
});
