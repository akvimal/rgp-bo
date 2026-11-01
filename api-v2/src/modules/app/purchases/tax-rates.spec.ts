import { parseTaxRates, taxRatesFor } from './tax-rates';

describe('purchase tax rates', () => {
  it('reads a list of rates, in order, without repeats or rubbish', () => {
    expect(parseTaxRates('18, 5 ,0,5')).toEqual([0, 5, 18]);
    expect(parseTaxRates('5%;12 18')).toEqual([5, 12, 18]);
    expect(parseTaxRates('x, -3, 101, 2.5')).toEqual([2.5]);
    expect(parseTaxRates('')).toEqual([]);
    expect(parseTaxRates(null)).toEqual([]);
  });

  it('offers the business own list, else the usual rates of its type', () => {
    expect(taxRatesFor('0,5', 'pharmacy')).toEqual([0, 5]);
    expect(taxRatesFor('', 'pharmacy')).toEqual([0, 5, 18]);
    expect(taxRatesFor(undefined, 'general')).toEqual([0, 5, 12, 18, 28]);
    expect(taxRatesFor('nonsense', 'pharmacy')).toEqual([0, 5, 18]);
    expect(taxRatesFor('', null)).toEqual([0, 5, 12, 18, 28]);
  });
});
