import { addDays, dueDateProblem, openDues, overdueOf } from './customer-due-rule';

describe('what a customer still owes, oldest first', () => {
  const rows = [
    { kind: 'DUE', amount: 500, sale_id: 1, due_date: '2026-11-10' },
    { kind: 'DUE', amount: 300, sale_id: 2, due_date: '2026-11-20' },
  ];
  it('lists every due when nothing has been paid', () => {
    expect(openDues(rows).map(d => [d.sale_id, d.remaining])).toEqual([[1, 500], [2, 300]]);
  });
  it('sets a payment against the oldest due first', () => {
    const open = openDues([...rows, { kind: 'PAYMENT', amount: -600, entry_date: '2026-11-12' }]);
    expect(open.map(d => [d.sale_id, d.remaining])).toEqual([[2, 200]]);
  });
  it('shows nothing once it is all paid', () => {
    expect(openDues([...rows, { kind: 'PAYMENT', amount: -800 }])).toEqual([]);
  });
  it('treats a raise by hand as due on the day it was made, and a reduction like a payment', () => {
    const open = openDues([...rows, { kind: 'ADJUSTMENT', amount: 100, entry_date: '2026-11-15' }, { kind: 'ADJUSTMENT', amount: -50 }]);
    expect(open.map(d => [d.sale_id, d.remaining, d.due_date])).toEqual([[1, 450, '2026-11-10'], [null, 100, '2026-11-15'], [2, 300, '2026-11-20']]);
  });
});

describe('what is overdue', () => {
  const open = openDues([
    { kind: 'DUE', amount: 500, sale_id: 1, due_date: '2026-11-10' },
    { kind: 'DUE', amount: 300, sale_id: 2, due_date: '2026-11-20' },
  ]);
  it('counts only what was promised for before today', () => {
    expect(overdueOf(open, '2026-11-15')).toEqual({ amount: 500, since: '2026-11-10' });
    expect(overdueOf(open, '2026-11-25')).toEqual({ amount: 800, since: '2026-11-10' });
  });
  it('is nothing on the promised day itself', () => {
    expect(overdueOf(open, '2026-11-10')).toEqual({ amount: 0, since: null });
  });
});

describe('the day the customer promised to pay', () => {
  it('is a week from today when left blank', () => {
    expect(dueDateProblem('', '2026-11-06').value).toBe('2026-11-13');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });
  it('accepts a date from today to 90 days away', () => {
    expect(dueDateProblem('2026-11-06', '2026-11-06')).toEqual({ value: '2026-11-06' });
    expect(dueDateProblem('2027-02-04', '2026-11-06').error).toBeUndefined();
  });
  it('refuses the past, a date too far off, and something that is not a date', () => {
    expect(dueDateProblem('2026-11-05', '2026-11-06').error).toMatch(/past/);
    expect(dueDateProblem('2027-02-05', '2026-11-06').error).toMatch(/90 days/);
    expect(dueDateProblem('soon', '2026-11-06').error).toMatch(/date/);
  });
});
