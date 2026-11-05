import { cleanScanLine, countsOf, itemFromLine, lineAmount, missingFor } from './scan-rules';

const RATES = [0, 5, 12, 18];
const full = { productid: 7, batch: 'AB12', exp: '2027-08', mrp: 120, qty: 10, free: 0, rate: 80, disc: 0, tax: 12 };

describe('what a line still lacks before it can be checked', () => {
  it('nothing when it is complete', () => expect(missingFor(full, RATES, false)).toEqual([]));
  it('names each missing thing in the form\'s words', () => {
    expect(missingFor({ ...full, productid: null, batch: ' ', exp: '', mrp: null, qty: 0, rate: null, tax: null }, RATES, false))
      .toEqual(['product', 'batch', 'expiry', 'MRP', 'quantity', 'rate', 'GST rate']);
  });
  it('a product that never expires needs no expiry', () => expect(missingFor({ ...full, exp: '' }, RATES, true)).toEqual([]));
  it('a GST rate that is not offered is missing', () => expect(missingFor({ ...full, tax: 28 }, RATES, false)).toEqual(['GST rate']));
  it('a zero rate is allowed (a free sample line), a missing one is not', () => {
    expect(missingFor({ ...full, rate: 0 }, RATES, false)).toEqual([]);
    expect(missingFor({ ...full, rate: null }, RATES, false)).toEqual(['rate']);
  });
});

describe('what was typed for a line', () => {
  it('batch is upper-cased and trimmed', () => expect(cleanScanLine({ batch: '  ab12 ' })).toEqual({ batch: 'AB12' }));
  it('only the fields sent are returned, so a save never blanks the rest', () => expect(cleanScanLine({ qty: '12' })).toEqual({ qty: 12 }));
  it('expiry is month and year, in a likely range', () => {
    expect(cleanScanLine({ exp: '2027-08' })).toEqual({ exp: '2027-08' });
    expect(() => cleanScanLine({ exp: '08/27' })).toThrow(/look like/);
    expect(() => cleanScanLine({ exp: '2002-08' })).toThrow(/not likely/);
  });
  it('a discount is held between 0 and 100, a negative amount is refused', () => {
    expect(cleanScanLine({ disc: 150 })).toEqual({ disc: 100 });
    expect(cleanScanLine({ disc: -5 })).toEqual({ disc: 0 });
    expect(() => cleanScanLine({ rate: -1 })).toThrow(/negative/);
  });
  it('an empty box clears a number', () => expect(cleanScanLine({ mrp: '' })).toEqual({ mrp: null }));
});

describe('the item a checked line becomes', () => {
  it('uses the item form\'s figures, and is verified at once', () => {
    const i = itemFromLine(55, { ...full, disc: 10, hsn: '30049099' }, 3);
    expect(i).toMatchObject({ invoiceid: 55, productid: 7, batch: 'AB12', expdate: '2027-08-01', mrpcost: 120, qty: 10, freeqty: 0, ptrvalue: 80, ptrcost: 89.6,
      discpcnt: 10, taxpcnt: 12, total: 720, hsn: '30049099', status: 'VERIFIED', verifiedby: 3 });
  });
  it('a product with no expiry has no expiry date on the item', () => expect('expdate' in itemFromLine(1, { ...full, exp: '' }, 1)).toBe(false));
  it('the amount is before tax', () => expect(lineAmount(10, 80, 0)).toBe(800));
});

describe('progress', () => {
  it('counts the lines by state', () => expect(countsOf([{ state: 'OPEN' }, { state: 'OPEN' }, { state: 'VERIFIED' }, { state: 'DISCARDED' }])).toEqual({ open: 2, verified: 1, discarded: 1, total: 4 }));
});
