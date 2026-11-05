import { cashFactor, invoiceNet, lineGst } from './purchase-totals';

describe('the GST of a line whose total is before tax', () => {
  it('is worked out on top of it, not taken out of it', () => {
    // the JL City line: 311.16 x 2 less 4% = 597.43 before tax; GST 5% is 29.87, not 28.45 (what dividing by 1.05 gave)
    expect(lineGst(597.43, 5, 'INTRA')).toEqual({ taxablevalue: 597.43, cgstamount: 14.94, sgstamount: 14.93, igstamount: 0 });
  });
  it('goes to IGST between states', () => expect(lineGst(1000, 12, 'INTER')).toEqual({ taxablevalue: 1000, cgstamount: 0, sgstamount: 0, igstamount: 120 }));
  it('a zero rate has no tax', () => expect(lineGst(250, 0, 'INTRA')).toEqual({ taxablevalue: 250, cgstamount: 0, sgstamount: 0, igstamount: 0 }));
  it('a missing rate is a zero rate', () => expect(lineGst(250, null, 'INTRA').cgstamount).toBe(0));
  it('splits an odd paisa so CGST + SGST is the whole tax', () => {
    const g = lineGst(100.1, 5, 'INTRA');                 // tax 5.005 -> 5.01
    expect(+(g.cgstamount + g.sgstamount).toFixed(2)).toBe(5.01);
  });
});

describe('what an invoice comes to', () => {
  // the six lines of the invoice that showed 2,014.91 as its net total but 1,928 as the balance
  const lines = [270, 301.13, 395.4, 79, 276, 597.43].map((total) => ({ total, taxpcnt: 5 }));
  it('is the lines plus their GST', () => {
    const n = invoiceNet(lines);
    expect(n.goods).toBe(1918.96);
    expect(n.tax).toBe(95.95);
    expect(n.net).toBe(2014.91);
  });
  it('mixes rates line by line', () => {
    const n = invoiceNet([{ total: 266.98, taxpcnt: 18 }, { total: 514.28, taxpcnt: 5 }]);
    expect(n.tax).toBe(+(266.98 * 0.18 + 514.28 * 0.05).toFixed(2));
  });
  it('a cash discount comes off the goods before tax, so the tax falls with it', () => {
    const n = invoiceNet([{ total: 1000, taxpcnt: 10 }], 100);       // 900 + 10% = 990
    expect(n).toEqual({ goods: 1000, tax: 90, net: 990 });
  });
  it('a cash discount as big as the goods is ignored (it is a mistake, not a free invoice)', () => expect(invoiceNet([{ total: 500, taxpcnt: 5 }], 500).net).toBe(525));
  it('no lines come to nothing', () => expect(invoiceNet([]).net).toBe(0));
  it('the factor is 1 with no discount', () => expect(cashFactor(1000, 0)).toBe(1));
});
