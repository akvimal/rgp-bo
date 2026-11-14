import { patterns, DayRow, notesFor } from './sales-patterns';

/** one row per day from `from` for `n` days, value from a function of the date */
const series = (from: string, n: number, f: (d: string, dow: number) => number): DayRow[] => {
  const out: DayRow[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.parse(from + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10);
    const dow = (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7;
    const v = f(d, dow);
    if (v > 0) out.push({ d, bills: Math.max(1, Math.round(v / 100)), value: v });
  }
  return out;
};
const TODAY = '2026-11-14';

describe('sales patterns', () => {
  it('averages per trading day, so a closed day does not lower the weekday figure', () => {
    // every Sunday closed; the other days sell 1000
    const days = series('2026-01-01', 300, (_d, dow) => (dow === 6 ? 0 : 1000));
    const p = patterns(days, [], TODAY);
    expect(p.weekday[0].avgValue).toBe(1000);
    expect(p.weekday[6].days).toBe(0);
    expect(p.weekday[6].thin).toBe(true);
    expect(p.weekday[0].index).toBe(100);
  });

  it('leaves out today (unfinished) and finds a stronger Saturday', () => {
    const days = series('2025-11-01', 380, (_d, dow) => (dow === 5 ? 1500 : 1000));
    const p = patterns(days, [], TODAY);
    expect(p.basis.to).toBe('2026-11-13');
    expect(p.weekday[5].index).toBeGreaterThan(p.weekday[1].index);
    expect(p.notes.join(' ')).toMatch(/Saturdays are \d+% above your average day/);
  });

  it('reads the day of the month: a strong first ten days', () => {
    const days = series('2025-11-01', 380, (d) => (+d.slice(8, 10) <= 10 ? 1400 : 1000));
    const p = patterns(days, [], TODAY);
    expect(p.dom[0].index).toBeGreaterThan(p.dom[20].index);
    expect(p.notes.join(' ')).toMatch(/first ten days of the month are \d+% above/);
  });

  it('builds the month-of-year index from complete months only', () => {
    // three years of 1000/day, every December at 2000/day (two complete Decembers)
    const days = series('2024-01-01', 1050, (d) => (d.slice(5, 7) === '12' ? 2000 : 1000));
    const p = patterns(days, [], TODAY);
    expect(p.months.find((m) => m.ym === TODAY.slice(0, 7))).toBeUndefined();
    expect(p.month[11].index).toBeGreaterThan(p.month[0].index);
    expect(p.notes.join(' ')).toMatch(/December is your strongest month/);
  });

  it('does not count a part-month at the start as a month', () => {
    const days = series('2026-03-20', 240, () => 1000);
    const p = patterns(days, [], TODAY);
    expect(p.months[0].ym).toBe('2026-04');
  });

  it('shows the share of sales per hour and names the busiest two hours', () => {
    const days = series('2026-01-01', 300, () => 1000);
    const hours = [{ h: 10, bills: 100, value: 10000 }, { h: 18, bills: 300, value: 40000 }, { h: 19, bills: 300, value: 40000 }, { h: 21, bills: 20, value: 10000 }];
    const p = patterns(days, hours, TODAY);
    expect(p.hour[18].share).toBe(40);
    expect(p.hour).toHaveLength(24);
    expect(p.notes[0]).toMatch(/Busiest hours: 6pm to 8pm bring 80% of sales/);
  });

  it('says so when there is too little history', () => {
    const p = patterns(series('2026-11-05', 9, () => 1000), [], TODAY);
    expect(p.notes[0]).toMatch(/Not enough trading days/);
    expect(notesFor({ hour: p.hour, weekday: p.weekday, dom: p.dom, month: p.month, trading: 3, monthsUsed: 0 })).toHaveLength(1);
  });
});
