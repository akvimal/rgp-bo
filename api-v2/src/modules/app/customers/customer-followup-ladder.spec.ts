import { DEFAULT_LADDER, LadderContact, recentlyLapsed, retryAdvice, weekStartOf } from './customer-followup-ladder';
import { DEFAULT_WINDOWS, TContact, evaluate } from './customer-turnaround-rules';

const at = (ymd: string, hh = 10) => new Date(`${ymd}T${String(hh).padStart(2, '0')}:00:00+05:30`);
const NOW = at('2026-11-20');
const c = (o: Partial<LadderContact> = {}): LadderContact => ({ customerId: 1, at: at('2026-11-16'), audience: 'due_back', source: 'refill', outcome: 'NO_ANSWER', tries: 1, bought: false, ...o });

describe('the retry ladder', () => {
  it('reminds the person to call again a few days after no answer, with the days left in the window', () => {
    // contact 16 Nov, today 20 Nov: 4 days, retry after 3, refill window 7 -> 4 days left (16+7 = 23 Nov)
    expect(retryAdvice(c(), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toEqual({ action: 'call_again', daysSince: 4, daysLeft: 4, nextTry: 2 });
  });

  it('a request to call back is a call again, a message sent is a nudge', () => {
    expect(retryAdvice(c({ outcome: 'CALLBACK' }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)!.action).toBe('call_again');
    expect(retryAdvice(c({ outcome: 'SENT' }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)!.action).toBe('nudge');
  });

  it('waits until the retry gap has passed, and stops when the window is over', () => {
    expect(retryAdvice(c({ at: at('2026-11-18') }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();           // 2 days: too soon
    expect(retryAdvice(c({ at: at('2026-11-17') }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).not.toBeNull();       // exactly 3
    expect(retryAdvice(c({ at: at('2026-11-12') }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();           // 8 days: the 7 day window is over
  });

  it('other reasons wait longer and have the longer window', () => {
    const other = c({ audience: 'at_risk', source: 'worklist', at: at('2026-11-16') });                          // 4 days
    expect(retryAdvice(other, DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();                                  // other retry gap is 5
    expect(retryAdvice({ ...other, at: at('2026-11-15') }, DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toMatchObject({ action: 'call_again', daysSince: 5, daysLeft: 10 });
  });

  it('leaves it alone once the customer bought, after the last try, or for outcomes that need no retry', () => {
    expect(retryAdvice(c({ bought: true }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();
    expect(retryAdvice(c({ tries: 3 }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();
    expect(retryAdvice(c({ tries: 2 }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).not.toBeNull();
    for (const outcome of ['REACHED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'ASKED_TO_STOP', 'WILL_BUY', 'BOUGHT_ELSEWHERE', 'NOT_NEEDED']) {
      expect(retryAdvice(c({ outcome }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();
    }
  });

  it('does not chase dues or review invites this way', () => {
    expect(retryAdvice(c({ audience: 'dues', source: 'worklist' }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();
    expect(retryAdvice(c({ audience: 'review_invite', source: 'worklist', outcome: 'SENT' }), DEFAULT_WINDOWS, DEFAULT_LADDER, NOW)).toBeNull();
  });

  it('the shop can change the gap and the number of tries', () => {
    expect(retryAdvice(c({ at: at('2026-11-18') }), DEFAULT_WINDOWS, { ...DEFAULT_LADDER, refillRetryDays: 2 }, NOW)).not.toBeNull();
    expect(retryAdvice(c({ tries: 1 }), DEFAULT_WINDOWS, { ...DEFAULT_LADDER, maxTries: 1 }, NOW)).toBeNull();
  });
});

describe('the lapsed roll-up', () => {
  const contact = (o: Partial<TContact>): TContact => ({ id: 1, customerId: 1, userId: 7, at: at('2026-11-05'), audience: 'at_risk', outcome: 'REACHED', source: 'worklist', dueOn: null, ...o });

  it('picks the contacts whose window ended in the last few days with no purchase, one per customer, latest contact first', () => {
    // window 14 days for other contacts: a contact on 5 Nov ended 19 Nov (1 day ago); on 1 Nov ended 15 Nov (5 days ago); on 20 Oct ended long ago
    const cs = [contact({ id: 1, customerId: 1, at: at('2026-11-05') }), contact({ id: 2, customerId: 2, at: at('2026-11-01') }), contact({ id: 3, customerId: 3, at: at('2026-10-20') }),
      contact({ id: 4, customerId: 2, at: at('2026-11-02') })];                       // customer 2 contacted twice: the later one counts
    const r = recentlyLapsed(evaluate(cs, [], DEFAULT_WINDOWS, NOW), 7, NOW);
    expect(r.map((x) => x.contact.customerId)).toEqual([1, 2]);
    expect(r.find((x) => x.contact.customerId === 2)!.contact.id).toBe(4);
  });

  it('leaves out those who came back and those still inside the window', () => {
    const cs = [contact({ id: 1, customerId: 1, at: at('2026-11-05') }), contact({ id: 2, customerId: 2, at: at('2026-11-12') })];
    const bills = [{ customerId: 1, at: at('2026-11-10'), value: 100, chronic: false }];
    expect(recentlyLapsed(evaluate(cs, bills, DEFAULT_WINDOWS, NOW), 7, NOW)).toEqual([]);
  });

  it('finds the Monday of a week', () => {
    expect(weekStartOf('2026-11-19')).toBe('2026-11-16');     // a Thursday
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');     // the Monday
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16');     // the Sunday
  });
});
