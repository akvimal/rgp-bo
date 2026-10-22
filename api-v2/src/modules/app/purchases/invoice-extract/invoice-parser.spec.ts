import { isGstin, parseInvoice, readDate, readExpiry, toLines, Word } from './invoice-parser';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** a GSTIN with a correct check character */
function gstin(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return first14 + CHARS[(36 - (sum % 36)) % 36];
}
const SUPPLIER = gstin('33AAAAA0000A1Z');
const BUYER = gstin('33BBBBB1111B1Z');

/** a row of cells at given x positions, as the words a PDF or OCR would give */
function row(y: number, cells: Array<[number, string]>, page = 1): Word[] {
  return cells.flatMap(([x, text]) => text.split(' ').map((t, i) => ({ t, x0: x + i * 28, x1: x + i * 28 + t.length * 6, y0: y - 8, y1: y, page })));
}

function layoutA(): Word[] {
  const H: Array<[number, string]> = [[20, 'Sl'], [50, 'Product'], [200, 'Pack'], [240, 'Batch'], [300, 'Exp'], [340, 'MRP'], [385, 'Qty'], [420, 'Free'], [455, 'Rate'], [500, 'Disc%'], [540, 'GST%'], [585, 'Amount']];
  return [
    ...row(20, [[40, 'SAMPLE DISTRIBUTORS PVT LTD']]),
    ...row(34, [[40, `GSTIN : ${SUPPLIER}`], [300, `Buyer GSTIN : ${BUYER}`]]),
    ...row(48, [[40, 'Invoice No : SD/24-25/0456'], [300, 'Invoice Date : 12/09/2026']]),
    ...row(62, [[40, 'Due Date : 12/10/2026']]),
    ...row(90, H),
    ...row(104, [[20, '1'], [50, 'PARACETAMOL 500MG TAB'], [200, '10x10'], [240, 'PC1234'], [300, '08/27'], [340, '30.00'], [385, '10'], [420, '2'], [455, '20.00'], [500, '5.00'], [540, '12.00'], [585, '190.00']]),
    ...row(118, [[20, '2'], [50, 'AMOXICILLIN 500MG CAP'], [200, '10'], [240, 'AX77'], [300, 'Aug-28'], [340, '95.00'], [385, '5'], [420, '0'], [455, '60.00'], [500, '0.00'], [540, '12.00'], [585, '300.00']]),
    ...row(129, [[50, '(10 CAPS)']]),
    ...row(150, [[50, 'Total'], [585, '490.00']]),
    ...row(165, [[40, 'Round off'], [585, '0.20']]),
    ...row(180, [[40, 'Net Amount'], [585, '549.00']]),
  ];
}

function layoutB(): Word[] {
  const H: Array<[number, string]> = [[30, 'Description'], [230, 'Batch No.'], [300, 'Exp. Dt'], [360, 'Qty'], [400, 'Rate'], [450, 'M.R.P'], [500, 'Amount'], [550, 'CGST%'], [600, 'SGST%']];
  return [
    ...row(18, [[30, 'Tax Invoice']]),
    ...row(32, [[30, 'Medi Wholesale']]),
    ...row(46, [[30, `GSTIN ${SUPPLIER}`]]),
    ...row(60, [[30, 'Bill No. B-9912'], [330, 'Date 03-Oct-2026']]),
    ...row(100, H),
    ...row(114, [[30, 'DOLO 650 TABLET'], [230, 'dl 9001'], [300, '11/2027'], [360, '10+2'], [400, '25.5'], [450, '31.00'], [500, '255.00'], [550, '6'], [600, '6']]),
    ...row(128, [[30, 'Sub Total'], [500, '255.00']]),
    ...row(142, [[30, 'Grand Total'], [500, '286.00']]),
  ];
}

describe('invoice parser', () => {
  it('reads dates and expiries as printed on Indian invoices', () => {
    expect(readDate('12/09/2026')).toBe('2026-09-12');
    expect(readDate('3-Oct-26')).toBe('2026-10-03');
    expect(readDate('7 September 2026')).toBe('2026-09-07');
    expect(readDate('31/02/2026')).toBe('2026-02-31');          // a printed date is taken as printed; the form checks the calendar
    expect(readExpiry('08/27')).toBe('2027-08-31');
    expect(readExpiry('2/2028')).toBe('2028-02-29');
    expect(readExpiry('Aug-28')).toBe('2028-08-31');
    expect(readExpiry('AUG 2027')).toBe('2027-08-31');
    expect(readExpiry('garbage')).toBeNull();
    expect(readExpiry('13/27')).toBeNull();
  });

  it('checks a GSTIN', () => {
    expect(isGstin(SUPPLIER)).toBe(true);
    expect(isGstin(SUPPLIER.slice(0, 14) + (SUPPLIER[14] === 'A' ? 'B' : 'A'))).toBe(false);
    expect(isGstin('short')).toBe(false);
  });

  it('layout A: header, a wrapped product name, free quantity, the amount check', () => {
    const r = parseInvoice(toLines(layoutA()), { ownGstin: BUYER });
    expect(r.tableFound).toBe(true);
    expect(r.header.suppliergstin).toBe(SUPPLIER);                  // not the buyer's
    expect(r.header.suppliername).toBe('SAMPLE DISTRIBUTORS PVT LTD');
    expect(r.header.invoiceno).toBe('SD/24-25/0456');
    expect(r.header.invoicedate).toBe('2026-09-12');
    expect(r.header.duedate).toBe('2026-10-12');
    expect(r.header.printedtotal).toBe(549);
    expect(r.lines).toHaveLength(2);
    const a = r.lines[0];
    expect(a).toMatchObject({ description: 'PARACETAMOL 500MG TAB', batch: 'PC1234', expdate: '2027-08-31', mrp: 30, qty: 10, free: 2, rate: 20, disc: 5, tax: 12, amount: 190 });
    expect(a.warnings).toEqual([]);
    expect(r.lines[1].description).toBe('AMOXICILLIN 500MG CAP (10 CAPS)');
    expect(r.lines[1]).toMatchObject({ batch: 'AX77', expdate: '2028-08-31', qty: 5, rate: 60, amount: 300 });
  });

  it('layout B: other column order, qty+free in one cell, CGST and SGST added, a misread digit is flagged', () => {
    const r = parseInvoice(toLines(layoutB()));
    expect(r.header.invoiceno).toBe('B-9912');
    expect(r.header.invoicedate).toBe('2026-10-03');
    expect(r.header.printedtotal).toBe(286);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ description: 'DOLO 650 TABLET', batch: 'DL9001', expdate: '2027-11-30', qty: 10, free: 2, rate: 25.5, mrp: 31, tax: 12, amount: 255 });

    const bad = layoutB().map((w) => (w.t === '255.00' && w.y1 === 114 ? { ...w, t: '205.00' } : w));
    const r2 = parseInvoice(toLines(bad));
    expect(r2.lines[0].warnings.join(' ')).toContain('does not match');
  });

  it('a photo: table borders read as characters and a slash read as a 7 do not stop the table being read', () => {
    const noisy = layoutA().flatMap((w) => [w, ...(w.t === 'Batch' ? [{ ...w, t: '|', x0: w.x0 - 5, x1: w.x0 - 3 }] : [])]).map((w) => (w.t === '08/27' ? { ...w, t: '|08727' } : w.t === '190.00' ? { ...w, t: '|190.00' } : w));
    const r = parseInvoice(toLines(noisy), { ownGstin: BUYER });
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ batch: 'PC1234', expdate: '2027-08-31', amount: 190, amountRead: 190 });
  });

  it('says so when there is no item table', () => {
    const r = parseInvoice(toLines(row(20, [[10, 'Just a letter about nothing in particular']])));
    expect(r.tableFound).toBe(false);
    expect(r.lines).toEqual([]);
    expect(r.warnings[0]).toContain('item table was not found');
  });
});
