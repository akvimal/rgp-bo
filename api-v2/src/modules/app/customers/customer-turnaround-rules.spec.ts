import { DEFAULT_WINDOWS, TBill, TContact, evaluate, istDayIndex, median, summarise, summariseByPerson } from './customer-turnaround-rules';

// a day at 10:00 Indian time, as a moment
const at = (ymd: string, hh = 10) => new Date(`${ymd}T${String(hh).padStart(2, '0')}:00:00+05:30`);
let n = 0;
const contact = (o: Partial<TContact> = {}): TContact => ({ id: ++n, customerId: 1, userId: 7, at: at('2026-11-02'), audience: 'due_back', outcome: 'REACHED', source: 'refill', dueOn: null, ...o });
const bill = (o: Partial<TBill> = {}): TBill => ({ customerId: 1, at: at('2026-11-05'), value: 500, chronic: true, ...o });
const NOW = at('2026-11-20');

describe('turnaround', () => {
  it('a refill contact turns around on a chronic bill inside 7 days, and says how long it took', () => {
    const [r] = evaluate([contact()], [bill()], DEFAULT_WINDOWS, NOW);
    expect(r).toMatchObject({ status: 'came_back', kind: 'refill', windowDays: 7, daysToReturn: 3, value: 500 });
  });

  it('the window is counted in Indian days: the last day still counts, the next does not', () => {
    expect(evaluate([contact()], [bill({ at: at('2026-11-09', 23) })], DEFAULT_WINDOWS, NOW)[0].status).toBe('came_back');   // day 7
    expect(evaluate([contact()], [bill({ at: at('2026-11-10', 1) })], DEFAULT_WINDOWS, NOW)[0].status).toBe('lapsed');        // day 8
  });

  it('a bill before the contact, or one with no chronic medicine for a refill reminder, does not count', () => {
    expect(evaluate([contact()], [bill({ at: at('2026-11-01') })], DEFAULT_WINDOWS, NOW)[0].status).toBe('lapsed');
    expect(evaluate([contact()], [bill({ chronic: false })], DEFAULT_WINDOWS, NOW)[0].status).toBe('lapsed');
  });

  it('another reason to get in touch takes any bill, in the longer window', () => {
    const c = contact({ audience: 'at_risk', source: 'worklist' });
    const r = evaluate([c], [bill({ chronic: false, at: at('2026-11-14') })], DEFAULT_WINDOWS, NOW)[0];
    expect(r).toMatchObject({ status: 'came_back', kind: 'other', windowDays: 14, daysToReturn: 12 });
  });

  it('is waiting while the window is open, with the days left, and lapsed once it is over', () => {
    const c = contact({ at: at('2026-11-18') });
    expect(evaluate([c], [], DEFAULT_WINDOWS, NOW)[0]).toMatchObject({ status: 'waiting', daysLeft: 6 });
    expect(evaluate([contact({ at: at('2026-11-02') })], [], DEFAULT_WINDOWS, NOW)[0].status).toBe('lapsed');
  });

  it('gives a bill to the latest contact before it, so two people never both claim it', () => {
    const a = contact({ userId: 1, at: at('2026-11-02') });
    const b = contact({ userId: 2, at: at('2026-11-04') });
    const r = evaluate([a, b], [bill({ at: at('2026-11-06') })], DEFAULT_WINDOWS, NOW);
    expect(r.find((x) => x.contact.id === b.id)!.status).toBe('came_back');
    expect(r.find((x) => x.contact.id === a.id)!.status).toBe('superseded');
  });

  it('an earlier contact whose window is over is lapsed, the later contact keeps the bill', () => {
    const a = contact({ userId: 1, at: at('2026-11-02') });
    const b = contact({ userId: 2, at: at('2026-11-08') });
    const r = evaluate([a, b], [bill({ at: at('2026-11-12') })], DEFAULT_WINDOWS, NOW);
    expect(r.find((x) => x.contact.id === a.id)!.status).toBe('lapsed');
    expect(r.find((x) => x.contact.id === b.id)!.status).toBe('came_back');
  });

  it('a customer who came back once can be reached again and come back again', () => {
    const a = contact({ at: at('2026-11-01') });
    const b = contact({ at: at('2026-11-10') });
    const r = evaluate([a, b], [bill({ at: at('2026-11-03') }), bill({ at: at('2026-11-12') })], DEFAULT_WINDOWS, NOW);
    expect(r.map((x) => x.status)).toEqual(['came_back', 'came_back']);
  });

  it('does not count a call nobody answered, a wrong number, a request to stop, dues or a review invite', () => {
    const cs = [contact({ outcome: 'NO_ANSWER' }), contact({ outcome: 'WRONG_NUMBER' }), contact({ outcome: 'ASKED_TO_STOP' }),
      contact({ audience: 'dues', source: 'worklist' }), contact({ audience: 'review_invite', source: 'worklist' })];
    const r = evaluate(cs, [bill()], DEFAULT_WINDOWS, NOW);
    expect(r.every((x) => x.status === 'not_counted')).toBe(true);
    expect(summarise(r)).toMatchObject({ contacts: 0, notCounted: 5, ratePct: null });
  });

  it('says how late a refill was against the day it was due', () => {
    const late = evaluate([contact({ dueOn: '2026-10-30' })], [bill()], DEFAULT_WINDOWS, NOW)[0];   // bill 5 Nov, due 30 Oct
    expect(late.daysAfterDue).toBe(6);
    const early = evaluate([contact({ dueOn: '2026-11-08' })], [bill()], DEFAULT_WINDOWS, NOW)[0];
    expect(early.daysAfterDue).toBe(-3);
    expect(evaluate([contact()], [bill()], DEFAULT_WINDOWS, NOW)[0].daysAfterDue).toBeNull();
  });

  it('keeps another customer\'s bills apart', () => {
    expect(evaluate([contact({ customerId: 1 })], [bill({ customerId: 2 })], DEFAULT_WINDOWS, NOW)[0].status).toBe('lapsed');
  });

  it('summarises: the rate is of those decided, waiting and superseded are left out', () => {
    const cs = [contact({ customerId: 1 }), contact({ customerId: 2 }), contact({ customerId: 3 }), contact({ customerId: 4, at: at('2026-11-19') })];
    const bs = [bill({ customerId: 1, at: at('2026-11-04'), value: 100 }), bill({ customerId: 2, at: at('2026-11-06'), value: 300 })];
    const s = summarise(evaluate(cs, bs, DEFAULT_WINDOWS, NOW));
    expect(s).toMatchObject({ contacts: 4, cameBack: 2, lapsed: 1, waiting: 1, ratePct: 67, medianDays: 3, value: 400 });
  });

  it('summarises each person on their own', () => {
    const cs = [contact({ userId: 1, customerId: 1 }), contact({ userId: 2, customerId: 2 }), contact({ userId: 2, customerId: 3 })];
    const r = summariseByPerson(evaluate(cs, [bill({ customerId: 2 })], DEFAULT_WINDOWS, NOW));
    expect(r.map((x) => [x.userId, x.summary.contacts, x.summary.cameBack])).toEqual([[2, 2, 1], [1, 1, 0]]);
  });

  it('works out the median and the Indian day', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    // 11 pm UTC on the 1st is already the 2nd in India
    expect(istDayIndex(new Date('2026-11-01T23:00:00Z'))).toBe(istDayIndex(new Date('2026-11-02T08:00:00Z')));
  });
});
