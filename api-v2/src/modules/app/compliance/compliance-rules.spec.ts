import { daysBetween, isRequired, ITEMS, itemOf, ladderFor, stepOf, waiverEnd } from './compliance-rules';

const base = { dueOn: '2026-10-20', lateDays: 3, escalateDays: 5, remindDays: 7 };

describe('stepOf', () => {
  it('is not listed before the reminder window', () => {
    expect(stepOf({ ...base, today: '2026-10-12' })).toBeNull();
  });
  it('is a reminder inside the window, before the due day', () => {
    expect(stepOf({ ...base, today: '2026-10-13' })).toBe('reminder');
    expect(stepOf({ ...base, today: '2026-10-19' })).toBe('reminder');
  });
  it('is due from the due day until it is late', () => {
    expect(stepOf({ ...base, today: '2026-10-20' })).toBe('due');
    expect(stepOf({ ...base, today: '2026-10-22' })).toBe('due');
  });
  it('is late after the item days and escalated after the business days', () => {
    expect(stepOf({ ...base, today: '2026-10-23' })).toBe('late');
    expect(stepOf({ ...base, today: '2026-10-24' })).toBe('late');
    expect(stepOf({ ...base, today: '2026-10-25' })).toBe('escalated');
  });
  it('never escalates before it is late', () => {
    expect(stepOf({ ...base, escalateDays: 1, today: '2026-10-22' })).toBe('due');
    expect(stepOf({ ...base, escalateDays: 1, today: '2026-10-23' })).toBe('escalated');
  });
  it('late on the due day when its late days are 0 (legal items)', () => {
    expect(stepOf({ ...base, lateDays: 0, today: '2026-10-20' })).toBe('late');
  });
  it('is held by a waiver until it ends, then returns to its step', () => {
    expect(stepOf({ ...base, today: '2026-10-25', waivedUntil: '2026-10-27' })).toBe('waived');
    expect(stepOf({ ...base, today: '2026-10-28', waivedUntil: '2026-10-27' })).toBe('escalated');
  });
  it('is done once done, whatever the date', () => {
    expect(stepOf({ ...base, today: '2026-11-30', done: true })).toBe('done');
  });
});

describe('ladderFor', () => {
  it('reads the business days, falling back to the defaults', () => {
    const stock = itemOf('stock_count')!;
    expect(ladderFor(stock, {})).toEqual({ lateDays: 3, escalateDays: 3 });
    expect(ladderFor(stock, { stock_count_late_days: 5, escalate_days: 8 })).toEqual({ lateDays: 5, escalateDays: 8 });
    expect(ladderFor(itemOf('licence')!, { escalate_days: 2 })).toEqual({ lateDays: 0, escalateDays: 2 });
  });
});

describe('waiverEnd', () => {
  it('counts today as the first day and holds to the longest', () => {
    expect(waiverEnd('2026-10-25', 3, 7)).toEqual({ ok: true, until: '2026-10-27' });
    expect(waiverEnd('2026-10-25', 8, 7)).toMatchObject({ ok: false });
    expect(waiverEnd('2026-10-25', 0, 7)).toMatchObject({ ok: false });
  });
});

describe('items', () => {
  it('has unique keys and a legal item that is late on its due day', () => {
    expect(new Set(ITEMS.map((i) => i.key)).size).toBe(ITEMS.length);
    expect(itemOf('licence')).toMatchObject({ cls: 'legal', lateDefault: 0 });
  });
  it('counts days between days', () => {
    expect(daysBetween('2026-10-20', '2026-10-25')).toBe(5);
    expect(daysBetween('2026-10-25', '2026-10-20')).toBe(-5);
  });
});

describe('isRequired ("do this to continue")', () => {
  const stock = itemOf('stock_count')!;
  const shift = itemOf('shift_close')!;
  it('starts after the gate days past the due day, for gate items only', () => {
    expect(isRequired(stock, {}, { dueOn: '2026-10-01', today: '2026-10-06' })).toBe(false);
    expect(isRequired(stock, {}, { dueOn: '2026-10-01', today: '2026-10-07' })).toBe(true);
    expect(isRequired(itemOf('licence')!, {}, { dueOn: '2026-01-01', today: '2026-10-07' })).toBe(false);
  });
  it('follows the business days', () => {
    expect(isRequired(stock, { stock_count_required_days: 2 }, { dueOn: '2026-10-01', today: '2026-10-03' })).toBe(true);
    expect(isRequired(shift, {}, { dueOn: '2026-10-24', today: '2026-10-25' })).toBe(true);
  });
  it('is not required when waived or done', () => {
    expect(isRequired(stock, {}, { dueOn: '2026-10-01', today: '2026-10-20', waivedUntil: '2026-10-22' })).toBe(false);
    expect(isRequired(stock, {}, { dueOn: '2026-10-01', today: '2026-10-20', done: true })).toBe(false);
  });
});
