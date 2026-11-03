import { staleGst, staleGstMessage } from './gst-guard';

const today = new Map([[1, { title: 'Aceclofenac', rate: 5 }], [2, { title: 'Paracetamol', rate: 12 }], [3, { title: 'Vitamin', rate: 18 }]]);

describe('GST on a completed bill', () => {
  it('passes lines that carry the rate in force today', () => {
    expect(staleGst([{ itemid: 1, taxpcnt: 5, qty: 2 }, { itemid: 2, taxpcnt: 12, qty: 1 }], today)).toEqual([]);
  });

  it('finds a line still at the old batch rate after the rate came down', () => {
    expect(staleGst([{ itemid: 1, taxpcnt: 12, qty: 2 }, { itemid: 2, taxpcnt: 12, qty: 1 }], today)).toEqual([{ itemid: 1, title: 'Aceclofenac', sent: 12, current: 5 }]);
  });

  it('ignores rounding noise, lines with nothing sold, and lines the server has no rate for', () => {
    expect(staleGst([{ itemid: 1, taxpcnt: 5.001, qty: 1 }], today)).toEqual([]);
    expect(staleGst([{ itemid: 1, taxpcnt: 12, qty: 0 }], today)).toEqual([]);
    expect(staleGst([{ itemid: 99, taxpcnt: 12, qty: 1 }], today)).toEqual([]);
  });

  it('lists a batch once however many lines it has, and treats a missing rate as 0%', () => {
    expect(staleGst([{ itemid: 1, taxpcnt: 12, qty: 1 }, { itemid: 1, taxpcnt: 12, qty: 3 }], today)).toHaveLength(1);
    expect(staleGst([{ itemid: 1, taxpcnt: undefined as any, qty: 1 }], today)).toEqual([{ itemid: 1, title: 'Aceclofenac', sent: 0, current: 5 }]);
  });

  it('says what changed, naming up to three items', () => {
    const m = staleGstMessage([{ itemid: 1, title: 'Aceclofenac', sent: 12, current: 5 }]);
    expect(m).toContain('1 item: Aceclofenac (12% on the bill, 5% today)');
    expect(staleGstMessage([1, 2, 3, 4].map((i) => ({ itemid: i, title: `P${i}`, sent: 12, current: 5 })))).toContain('4 items: P1');
    expect(staleGstMessage([1, 2, 3, 4].map((i) => ({ itemid: i, title: `P${i}`, sent: 12, current: 5 })))).toContain('...');
  });
});
