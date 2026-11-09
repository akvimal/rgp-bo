import {
  GRACE_DAYS, LAPSED_DAYS, RVisit, callEffect, compareCohort, eventsOf, expectations, pick, refillHistoryFrom, statusOf, summarise,
} from './review-refill';

const v = (customerId: number, day: string, value = 100, storeId = 1): RVisit => ({ customerId, day, storeId, value });
/** a customer who buys every `gap` days from `start`, `n` times */
const rhythm = (customerId: number, start: string, gap: number, n: number, value = 100): RVisit[] =>
  Array.from({ length: n }, (_, i) => v(customerId, new Date(Date.parse(start + 'T00:00:00Z') + i * gap * 86400000).toISOString().slice(0, 10), value));

describe('refill capture', () => {
  it('a top-up within a week of a refill is part of the same event, with the values added', () => {
    const e = eventsOf([v(1, '2026-01-01', 100), v(1, '2026-01-04', 50), v(1, '2026-01-08', 70), v(1, '2026-02-07', 80)]);
    expect(e.map((x) => [x.day, x.value])).toEqual([['2026-01-01', 150], ['2026-01-08', 70], ['2026-02-07', 80]]);   // the 4th joins the 1st; the 8th is a week after it
  });

  it('an expectation needs three events, and uses the usual gap known at the time', () => {
    const two = expectations(rhythm(1, '2026-01-01', 30, 2), '2026-11-09');
    expect(two).toEqual([]);
    const four = expectations(rhythm(1, '2026-01-01', 30, 4), '2026-11-09');
    expect(four.map((x) => [x.eventDay, x.expectedOn, x.usualGap])).toEqual([['2026-03-02', '2026-04-01', 30], ['2026-04-01', '2026-05-01', 30]]);
    expect(four[0].nextDay).toBe('2026-04-01');                         // the third event's next refill is the fourth
    expect(four[1].nextDay).toBeNull();
  });

  it('a gap longer than 150 days is not a rhythm', () => {
    expect(expectations(rhythm(1, '2025-01-01', 200, 4), '2026-11-09')).toEqual([]);
  });

  it('on time, late, not back yet, lapsed, or still within the grace period', () => {
    expect(statusOf('2026-06-01', '2026-06-01', '2026-11-09')).toBe('ON_TIME');
    expect(statusOf('2026-06-01', '2026-06-08', '2026-11-09')).toBe('ON_TIME');                 // exactly the grace period
    expect(statusOf('2026-06-01', '2026-06-09', '2026-11-09')).toBe('LATE');
    expect(statusOf('2026-06-01', null, '2026-06-05')).toBe('OPEN');
    expect(statusOf('2026-06-01', null, '2026-06-20')).toBe('NOT_BACK');
    expect(statusOf('2026-06-01', null, '2026-07-16')).toBe('NOT_BACK');                        // 45 days over
    expect(statusOf('2026-06-01', null, '2026-07-17')).toBe('LAPSED');
    expect(GRACE_DAYS).toBe(7); expect(LAPSED_DAYS).toBe(45);
  });

  it('a cohort counts the customers due in the week, only at the stores asked for', () => {
    const visits = [
      ...rhythm(1, '2026-01-01', 30, 4),                               // expected 2026-05-01 after the 4th... see below
      ...rhythm(2, '2026-01-05', 30, 3), v(2, '2026-03-20'),           // a different rhythm
    ];
    const all = expectations(visits, '2026-11-09');
    const due = pick(all, '2026-04-01', '2026-04-01', null);
    expect(due.map((x) => x.customerId)).toEqual([1]);               // customer 1: third event 2026-03-02, expected 2026-04-01
    expect(pick(all, '2026-04-01', '2026-04-01', [2]).length).toBe(0);   // another store
    expect(pick(all, '2026-04-01', '2026-04-01', [1]).length).toBe(1);
  });

  it('capture rate is on time over those whose grace has passed; still-open ones are left out', () => {
    // customers who each have a rhythm of 30 days and are due 2026-06-01 (third event 2026-05-02)
    const make = (id: number, nextDay: string | null): RVisit[] => {
      const base = [v(id, '2026-03-03'), v(id, '2026-04-02'), v(id, '2026-05-02')];
      return nextDay ? [...base, v(id, nextDay)] : base;
    };
    const visits = [...make(1, '2026-06-01'), ...make(2, '2026-06-05'), ...make(3, '2026-06-20'), ...make(4, null), ...make(5, '2026-06-03')];
    const e = expectations(visits, '2026-11-09').filter((x) => x.eventDay === '2026-05-02');
    const s = summarise(pick(e, '2026-06-01', '2026-06-01', null), '2026-06-01', '2026-06-01');
    expect(s).toMatchObject({ due: 5, onTime: 3, late: 1, lapsed: 1, notBack: 0, open: 0, decided: 5, missed: 2, captureRate: 60, missRate: 40 });
    expect(s.valueAtRisk).toBe(100);                                  // customer 4: lapsed, a typical 100
    // as of three days after, customer 4 is still within grace and not counted
    const early = expectations(visits.filter((x) => !(x.day > '2026-06-04')), '2026-06-04').filter((x) => x.eventDay === '2026-05-02');
    const es = summarise(pick(early, '2026-06-01', '2026-06-01', null), '2026-06-01', '2026-06-01');
    expect(es.open).toBe(3);                                          // 3 and 4 had not come, and 5 had not yet
    expect(es.decided).toBe(es.due - es.open);
  });

  it('worse than usual only by a clear margin with several more cases', () => {
    const usual = summarise([], 'a', 'b');
    expect(compareCohort(usual, usual).verdict).toBe('unknown');      // nothing to compare with
    const s = (due: number, missed: number) => ({ ...usual, due, decided: due, missed, onTime: due - missed, missRate: due ? Math.round((missed / due) * 1000) / 10 : null });
    expect(compareCohort(s(100, 40), s(400, 100)).verdict).toBe('above');    // 40% against a usual 25%, 15 more cases
    expect(compareCohort(s(100, 28), s(400, 100)).verdict).toBe('usual');
    expect(compareCohort(s(10, 5), s(400, 100)).verdict).toBe('usual');      // half against a quarter, but only 2.5 more cases: noise
    expect(compareCohort(s(100, 10), s(400, 100)).verdict).toBe('below');
  });

  it('calls: capture rate with a call against without, ignoring no-answer and calls made too early', () => {
    const rows = [
      { customerId: 1, storeId: 1, eventDay: '2026-05-02', expectedOn: '2026-06-01', usualGap: 30, value: 100, nextDay: '2026-06-02', status: 'ON_TIME' as const },
      { customerId: 2, storeId: 1, eventDay: '2026-05-02', expectedOn: '2026-06-01', usualGap: 30, value: 100, nextDay: null, status: 'LAPSED' as const },
      { customerId: 3, storeId: 1, eventDay: '2026-05-02', expectedOn: '2026-06-01', usualGap: 30, value: 100, nextDay: '2026-06-03', status: 'ON_TIME' as const },
      { customerId: 4, storeId: 1, eventDay: '2026-05-02', expectedOn: '2026-06-01', usualGap: 30, value: 100, nextDay: null, status: 'OPEN' as const },
    ];
    const f = [
      { customerId: 1, day: '2026-05-28', outcome: 'WILL_BUY' },       // within the lead: counts
      { customerId: 2, day: '2026-06-10', outcome: 'NO_ANSWER' },      // no answer: not a call
      { customerId: 3, day: '2026-04-01', outcome: 'CALLBACK' },       // long before: not a call for this refill
    ];
    const c = callEffect(rows, f, '2026-11-09');
    expect(c.called).toEqual({ n: 1, onTime: 1, rate: 100 });
    expect(c.notCalled).toEqual({ n: 2, onTime: 1, rate: 50 });        // customer 4 is open and left out
  });

  it('asks for two years of history before the usual window', () => {
    expect(refillHistoryFrom('2026-11-09')).toBe(new Date(Date.parse('2026-11-09T00:00:00Z') - (7 * 14 + 730) * 86400000).toISOString().slice(0, 10));
  });
});
