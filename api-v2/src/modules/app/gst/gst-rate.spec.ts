import { effectiveHsn, matches, parseChange, parseHsn, priceImpact, rateOn, winner, RateChange, ProductFacts } from './gst-rate';

const prod = (over: Partial<ProductFacts> = {}): ProductFacts => ({ id: 7, category: 'Tablet', hsn: '30049099', categoryHsn: null, ...over });
const chg = (over: Partial<RateChange>): RateChange => ({ id: 1, scope_type: 'all', scope_value: '', mode: 'cap', rate: 5, effective_from: '2025-09-22', ...over });

describe('gst rate changes', () => {
  it('bills the batch rate until a change is in force, then the changed rate', () => {
    const changes = [chg({ scope_type: 'category', scope_value: 'tablet', mode: 'set', rate: 5, effective_from: '2026-11-01' })];
    expect(rateOn(changes, prod(), 12, '2026-10-31')).toBe(12);
    expect(rateOn(changes, prod(), 12, '2026-11-01')).toBe(5);
    expect(rateOn(changes, prod({ category: 'Syrup' }), 12, '2026-11-01')).toBe(12);
  });

  it('a cap only lowers; a set replaces', () => {
    expect(rateOn([chg({ mode: 'cap', rate: 5 })], prod(), 3, '2026-01-01')).toBe(3);
    expect(rateOn([chg({ mode: 'cap', rate: 5 })], prod(), 18, '2026-01-01')).toBe(5);
    expect(rateOn([chg({ mode: 'set', rate: 5 })], prod(), 3, '2026-01-01')).toBe(5);
  });

  it('the most specific change wins, whatever its date, and the longest HSN prefix beats a shorter one', () => {
    const changes = [
      chg({ id: 1, scope_type: 'all', mode: 'cap', rate: 5, effective_from: '2026-06-01' }),
      chg({ id: 2, scope_type: 'category', scope_value: 'Tablet', mode: 'set', rate: 12, effective_from: '2025-01-01' }),
      chg({ id: 3, scope_type: 'hsn_prefix', scope_value: '3004', mode: 'set', rate: 5, effective_from: '2025-01-01' }),
      chg({ id: 4, scope_type: 'hsn_prefix', scope_value: '300490', mode: 'set', rate: 18, effective_from: '2025-01-01' }),
      chg({ id: 5, scope_type: 'product', scope_value: '7', mode: 'set', rate: 0, effective_from: '2025-01-01' }),
    ];
    expect(winner(changes, prod(), '2026-07-01')!.id).toBe(5);
    expect(winner(changes.slice(0, 4), prod(), '2026-07-01')!.id).toBe(4);
    expect(winner(changes.slice(0, 3), prod(), '2026-07-01')!.id).toBe(3);
    expect(winner(changes.slice(0, 2), prod(), '2026-07-01')!.id).toBe(2);
    expect(winner(changes.slice(0, 1), prod(), '2026-07-01')!.id).toBe(1);
  });

  it('of equal specificity the later date wins, and a change not yet in force is ignored', () => {
    const changes = [
      chg({ id: 1, scope_type: 'category', scope_value: 'Tablet', mode: 'set', rate: 12, effective_from: '2025-01-01' }),
      chg({ id: 2, scope_type: 'category', scope_value: 'Tablet', mode: 'set', rate: 5, effective_from: '2026-04-01' }),
    ];
    expect(rateOn(changes, prod(), 18, '2026-03-31')).toBe(12);
    expect(rateOn(changes, prod(), 18, '2026-04-01')).toBe(5);
  });

  it('a product with no HSN of its own uses its category default; with neither it is not covered by an HSN change', () => {
    const c = chg({ scope_type: 'hsn_prefix', scope_value: '3004', mode: 'set', rate: 5 });
    expect(matches(c, prod({ hsn: '', categoryHsn: '3004' }))).toBe(true);
    expect(matches(c, prod({ hsn: '', categoryHsn: null }))).toBe(false);
    expect(effectiveHsn(prod({ hsn: ' ', categoryHsn: '3004' }))).toEqual({ hsn: '3004', source: 'category' });
    expect(effectiveHsn(prod({ hsn: '', categoryHsn: null })).source).toBe('none');
    expect(effectiveHsn(prod()).source).toBe('own');
  });

  it('a category change still covers a product with no HSN', () => {
    expect(rateOn([chg({ scope_type: 'category', scope_value: 'Tablet', mode: 'set', rate: 5 })], prod({ hsn: '' }), 12, '2026-12-01')).toBe(5);
  });
});

describe('price impact of a rate cut', () => {
  it('MRP 112 at 12% is 100 plus 12; at 5% passing the saving on charges 105', () => {
    const r = priceImpact(100, 112, 12, 5);
    expect(r.now).toBe(112);
    expect(r.pass).toEqual({ price: 100, customer: 105 });
  });

  it('keeping the price raises the price without GST to 106.66 (106.67 plus GST would be above the MRP), so the customer pays 111.99', () => {
    const r = priceImpact(100, 112, 12, 5);
    expect(r.keep).toEqual({ price: 106.66, customer: 111.99, capped: false });
  });

  it('keeping the price never goes above the MRP less the new GST', () => {
    const r = priceImpact(110, 112, 12, 5);                       // already charging the top: 110 plus 12% is above the MRP, so the customer paid 112
    expect(r.keep!.customer).toBeLessThanOrEqual(112);
    expect(r.keep!.price).toBeLessThanOrEqual(106.66);
  });

  it('says nothing for a product with no price', () => {
    expect(priceImpact(null, 112, 12, 5).pass).toBeNull();
  });
});

describe('what the Business Head sends', () => {
  const ok = { scope_type: 'category', scope_value: 'Tablet', mode: 'set', rate: 5, effective_from: '2026-11-01' };

  it('accepts a good change and defaults to passing the saving on', () => {
    const r = parseChange(ok);
    expect(r.error).toBeUndefined();
    expect(r.value).toMatchObject({ scope_type: 'category', scope_value: 'Tablet', mode: 'set', rate: 5, price_policy: 'pass_saving' });
  });

  it('refuses a missing scope value, a bad HSN prefix, a rate out of range and a missing date', () => {
    expect(parseChange({ ...ok, scope_value: '' }).error).toMatch(/Say which/);
    expect(parseChange({ ...ok, scope_type: 'hsn_prefix', scope_value: 'abc' }).error).toMatch(/2 to 8 digits/);
    expect(parseChange({ ...ok, rate: 41 }).error).toMatch(/between 0 and 40/);
    expect(parseChange({ ...ok, effective_from: 'soon' }).error).toMatch(/date/);
    expect(parseChange({ ...ok, scope_type: 'galaxy' }).error).toMatch(/covers/);
    expect(parseChange({ ...ok, mode: 'raise' }).error).toMatch(/sets the rate or caps/);
  });

  it('"all products" needs no value', () => {
    expect(parseChange({ scope_type: 'all', mode: 'cap', rate: 5, effective_from: '2025-09-22' }).value!.scope_value).toBe('');
  });

  it('HSN codes are 4, 6 or 8 digits', () => {
    expect(parseHsn('3004').value).toBe('3004');
    expect(parseHsn('3004 90 99').value).toBe('30049099');
    expect(parseHsn('300').error).toBeTruthy();
    expect(parseHsn('30049').error).toBeTruthy();
    expect(parseHsn('ABCD').error).toBeTruthy();
  });
});
