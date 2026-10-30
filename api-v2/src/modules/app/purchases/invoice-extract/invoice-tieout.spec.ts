import { linesTotalWithTax, parseInvoice, toLines, Word } from './invoice-parser';
import { tieOut } from './invoice-tieout';

const header = (o: any = {}) => ({ invoiceno: 'A1', invoicedate: '2026-10-27', duedate: null, suppliergstin: null, suppliername: null, printedtotal: 1180, goodsvalue: null, cashdiscount: null, ...o });
const line = (o: any = {}) => ({ description: 'X', hsn: null, batch: 'B1', expdate: '2028-01-01', mrp: null, qty: 10, free: 0, rate: 100, disc: 0, tax: 18, amount: 1000, amountRead: 1000, warnings: [], ...o });

describe('does the read agree with itself', () => {
  it('is reconciled when the lines with tax match the printed total, within the rounding', () => {
    const t = tieOut({ header: header(), lines: [line()] }, 1180);
    expect(t.status).toBe('RECONCILED');
    expect(t.headline).toContain('1,180.00');
    expect(tieOut({ header: header({ printedtotal: 1179.6 }), lines: [line()] }, 1180).status).toBe('RECONCILED');
  });

  it('needs review when the total is off, and says by how much and which way', () => {
    const t = tieOut({ header: header({ printedtotal: 1500 }), lines: [line()] }, 1180);
    expect(t.status).toBe('REVIEW');
    expect(t.checks.find((c) => c.key === 'total')!.detail).toContain('the invoice is 320.00 higher');
  });

  it('names the lines whose quantity x rate does not agree with the amount printed', () => {
    const t = tieOut({ header: header({ printedtotal: 2360 }), lines: [line(), line({ qty: 7, amountRead: 1000 }), line()] }, 3540);
    const a = t.checks.find((c) => c.key === 'arithmetic')!;
    expect(a.state).toBe('fail');
    expect(a.lines).toEqual([2]);
    expect(t.status).toBe('REVIEW');
  });

  it('accepts an amount printed with its tax, or before the discount is taken off', () => {
    expect(tieOut({ header: header(), lines: [line({ amountRead: 1180 })] }, 1180).checks.find((c) => c.key === 'arithmetic')!.state).toBe('ok');
    expect(tieOut({ header: header(), lines: [line({ disc: 5, amountRead: 1000, amount: 950 })] }, 1121).checks.find((c) => c.key === 'arithmetic')!.state).toBe('ok');
  });

  it('cannot be checked without a printed total, and is not called reconciled', () => {
    const t = tieOut({ header: header({ printedtotal: null }), lines: [line()] }, 1180);
    expect(t.status).toBe('UNVERIFIED');
    expect(t.headline).toContain('no printed total');
  });

  it('needs review when the invoice number, the date or every line is missing', () => {
    expect(tieOut({ header: header({ invoiceno: null }), lines: [line()] }, 1180).status).toBe('REVIEW');
    const none = tieOut({ header: header(), lines: [] }, 0);
    expect(none.status).toBe('REVIEW');
    expect(none.checks.find((c) => c.key === 'lines')!.state).toBe('fail');
  });

  it('flags stock that expired in an earlier month than the invoice, but not the invoice month itself', () => {
    const t = tieOut({ header: header(), lines: [line({ expdate: '2026-09-01' }), line({ expdate: '2026-10-01' })] }, 2360);
    expect(t.checks.find((c) => c.key === 'expiry')!.lines).toEqual([1]);
  });

  it('reconciles the real PALEPU scan: five lines, 3% on each line, printed total 3902.00', () => {
    const words: Word[] = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'palepu-scan.words.json'), 'utf8'));
    const p = parseInvoice(toLines(words), {});
    const t = tieOut(p, linesTotalWithTax(p.lines, p.header));
    expect(t.status).toBe('RECONCILED');
    expect(t.checks.every((c) => c.state !== 'fail')).toBe(true);
  });
});
