import { DeliveryRef, EntryRef, MAX_DAYS, daysApart, matchOf, matchesFor, suggestLinks } from './delivery-cost-match';

const del = (o: Partial<DeliveryRef> = {}): DeliveryRef => ({ saleId: 1, billNo: 1234, storeId: 1, cost: 60, day: '2026-10-10', receiver: 'Priya', by: 'Ramesh', partner: null, ...o });
const cash = (o: Partial<EntryRef> = {}): EntryRef => ({ kind: 'CASH', id: 50, storeId: 1, amount: 60, day: '2026-10-10', text: 'Delivery charge', categoryHint: false, ...o });
const exp = (o: Partial<EntryRef> = {}): EntryRef => ({ kind: 'DIGITAL', id: 70, storeId: 1, amount: 60, day: '2026-10-11', text: 'DTDC', categoryHint: true, ...o });

describe('delivery cost matching', () => {
  it('counts the days between two dates', () => {
    expect(daysApart('2026-10-10', '2026-10-13')).toBe(3);
    expect(daysApart('2026-10-13', '2026-10-10')).toBe(3);
    expect(daysApart('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('an entry is a candidate only with the exact amount, at the same store, within a week', () => {
    expect(matchOf(del(), cash())).not.toBeNull();
    expect(matchOf(del({ cost: 60.004 }), cash())).not.toBeNull();                                  // a rounding difference
    expect(matchOf(del(), cash({ amount: 61 }))).toBeNull();
    expect(matchOf(del(), cash({ storeId: 2 }))).toBeNull();
    expect(matchOf(del(), cash({ day: `2026-10-${10 + MAX_DAYS + 1}` }))).toBeNull();
    expect(matchOf(del(), cash({ day: `2026-10-${10 + MAX_DAYS}` }))).not.toBeNull();
    expect(matchOf(del({ cost: 0 }), cash({ amount: 0 }))).toBeNull();                               // nothing was paid
    expect(matchOf(del(), cash({ storeId: null }))).not.toBeNull();                                  // a business-level expense can cover any store
  });

  it('is sure only when near, at the same store, and about a delivery', () => {
    const sure = matchOf(del(), cash());
    expect(sure).toMatchObject({ level: 'sure', days: 0 });
    expect(sure!.reasons).toContain('says delivery or courier');
    expect(matchOf(del(), exp())).toMatchObject({ level: 'sure', days: 1 });                        // filed under transport and courier
    expect(matchOf(del(), cash({ text: 'Tea and snacks' }))).toMatchObject({ level: 'maybe' });      // right amount and day, nothing says delivery
    expect(matchOf(del(), cash({ day: '2026-10-16' }))).toMatchObject({ level: 'maybe', days: 6 });  // delivery in the words, but too far in date
    expect(matchOf(del(), cash({ storeId: null }))).toMatchObject({ level: 'maybe' });               // not the delivery's own store
  });

  it('recognises the bill number and the people in the words', () => {
    expect(matchOf(del(), cash({ text: 'Auto fare #1234' }))!.reasons).toContain('names the bill');
    expect(matchOf(del(), cash({ text: 'paid ramesh' }))!.reasons).toContain('names who delivered or received');
    expect(matchOf(del({ partner: 'Blue Dart' }), cash({ text: 'BLUE DART pickup' }))!.reasons).toContain('names who delivered or received');
    expect(matchOf(del({ billNo: 12 }), cash({ text: 'misc 123' }))!.reasons).not.toContain('names the bill');   // a short number is not a clue
  });

  it('lists the candidates best first: sure before maybe, then nearest', () => {
    const entries = [cash({ id: 1, text: 'tea', day: '2026-10-10' }), cash({ id: 2, day: '2026-10-12' }), cash({ id: 3, day: '2026-10-10' }), cash({ id: 4, amount: 99 })];
    expect(matchesFor(del(), entries).map((m) => m.entryId)).toEqual([3, 2, 1]);
  });

  it('suggests a pair only when it is sure and the only one, both ways', () => {
    const one = suggestLinks([del()], [cash()]);
    expect(one.pairs).toEqual([expect.objectContaining({ saleId: 1, kind: 'CASH', entryId: 50, level: 'sure' })]);
    expect(one.undecided).toBe(0);
    // two entries could be it: left for a person
    expect(suggestLinks([del()], [cash({ id: 50 }), cash({ id: 51 })])).toMatchObject({ pairs: [], undecided: 1 });
    // two deliveries of the same cost want the same entry: left for a person
    expect(suggestLinks([del({ saleId: 1 }), del({ saleId: 2, billNo: 2000 })], [cash()])).toMatchObject({ pairs: [], undecided: 2 });
    // a maybe is never suggested
    expect(suggestLinks([del()], [cash({ text: 'tea' })])).toMatchObject({ pairs: [], undecided: 1 });
    // nothing close: nothing to decide
    expect(suggestLinks([del()], [cash({ amount: 5 })])).toEqual({ pairs: [], undecided: 0 });
  });

  it('two deliveries at different dates each find their own entry', () => {
    const deliveries = [del({ saleId: 1, day: '2026-10-01' }), del({ saleId: 2, billNo: 2000, day: '2026-10-20' })];
    const entries = [cash({ id: 50, day: '2026-10-01' }), cash({ id: 51, day: '2026-10-20' })];
    const r = suggestLinks(deliveries, entries);
    expect(r.pairs.map((p) => [p.saleId, p.entryId])).toEqual([[1, 50], [2, 51]]);
  });
});
