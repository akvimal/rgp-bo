import { cashFactor, isGstin, linesTotalWithTax, parseInvoice, readDate, readExpiry, repairGstin, toLines, Word } from './invoice-parser';

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
const SCAN_SUPPLIER = gstin('27BQXPK3917M1Z');                 // varied letters: a repeated pattern can make several corrections look valid
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
    expect(readExpiry('08/27')).toBe('2027-08-01');
    expect(readExpiry('2/2028')).toBe('2028-02-01');
    expect(readExpiry('Aug-28')).toBe('2028-08-01');
    expect(readExpiry('AUG 2027')).toBe('2027-08-01');
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
    expect(a).toMatchObject({ description: 'PARACETAMOL 500MG TAB', batch: 'PC1234', expdate: '2027-08-01', mrp: 30, qty: 10, free: 2, rate: 20, disc: 5, tax: 12, amount: 190 });
    expect(a.warnings).toEqual([]);
    expect(r.lines[1].description).toBe('AMOXICILLIN 500MG CAP (10 CAPS)');
    expect(r.lines[1]).toMatchObject({ batch: 'AX77', expdate: '2028-08-01', qty: 5, rate: 60, amount: 300 });
  });

  it('layout B: other column order, qty+free in one cell, CGST and SGST added, a misread digit is flagged', () => {
    const r = parseInvoice(toLines(layoutB()));
    expect(r.header.invoiceno).toBe('B-9912');
    expect(r.header.invoicedate).toBe('2026-10-03');
    expect(r.header.printedtotal).toBe(286);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ description: 'DOLO 650 TABLET', batch: 'DL9001', expdate: '2027-11-01', qty: 10, free: 2, rate: 25.5, mrp: 31, tax: 12, amount: 255 });

    const bad = layoutB().map((w) => (w.t === '255.00' && w.y1 === 114 ? { ...w, t: '205.00' } : w));
    const r2 = parseInvoice(toLines(bad));
    expect(r2.lines[0].warnings.join(' ')).toContain('does not match');
  });

  it('a photo: table borders read as characters and a slash read as a 7 do not stop the table being read', () => {
    const noisy = layoutA().flatMap((w) => [w, ...(w.t === 'Batch' ? [{ ...w, t: '|', x0: w.x0 - 5, x1: w.x0 - 3 }] : [])]).map((w) => (w.t === '08/27' ? { ...w, t: '|08727' } : w.t === '190.00' ? { ...w, t: '|190.00' } : w));
    const r = parseInvoice(toLines(noisy), { ownGstin: BUYER });
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ batch: 'PC1234', expdate: '2027-08-01', amount: 190, amountRead: 190 });
  });

  it('says so when there is no item table', () => {
    const r = parseInvoice(toLines(row(20, [[10, 'Just a letter about nothing in particular']])));
    expect(r.tableFound).toBe(false);
    expect(r.lines).toEqual([]);
    expect(r.warnings[0]).toContain('item table was not found');
  });
});

/** a scanned page as OCR gave it: batch and expiry before the product name, a centred "PRODUCT NAME" header, header words misread
 *  (REE, ALUE, IS), no MRP header, quantities dropped, stray marks, a cash discount under the goods value */
function scan(): Word[] {
  const w = (t: string, x0: number, x1: number, y: number): Word => ({ t, x0, x1, y0: y - 30, y1: y, page: 1 });
  const row = (y: number, cells: Array<[string, number, number]>) => cells.map(([t, a, b]) => w(t, a, b, y));
  return [
    ...row(100, [['SAMPLE', 600, 700], ['DISTRIBUTORS', 710, 900]]),
    ...row(160, [['GST', 1100, 1160], [`${SCAN_SUPPLIER.slice(0, 11)}0${SCAN_SUPPLIER.slice(12)}`, 1180, 1500]]),   // a letter misread as a digit
    ...row(220, [['INV', 1100, 1160], ['NO', 1170, 1210], [':IN55001', 1220, 1400]]),
    ...row(280, [['Date', 1352, 1398], ['otros', 1420, 1543], ['Page', 1818, 1884]]),                            // the date itself was not read
    ...row(340, [['MFR', 107, 157], ['BATCH', 188, 276], ['EXP', 389, 484], ['PRODUCT', 655, 780], ['NAME', 787, 856], ['QTY', 1077, 1125], ['REE', 1176, 1219], ['RATE', 1285, 1345], ['IS', 1549, 1575], ['So', 1588, 1637], ['GST', 1589, 1657], ['ALUE', 1772, 1831], ['HSN', 1849, 1935]]),
    ...row(400, [['"SPECIAL', 92, 199], ['OFFER', 207, 415], ['1+1**', 1219, 1274]]),
    ...row(460, [['ABB', 104, 145], ['*ZLA26016', 177, 315], ['04/29', 409, 481], ['SAMPLEFRESH', 503, 632], ['10MG', 652, 716], ['TAB', 734, 782], ["15's", 819, 881], ['104.56', 1264, 1342], ['137.23', 1402, 1480], ['5.00', 1615, 1659], ['313.68', 1755, 1824], ['30049082', 1838, 1939]]),
    ...row(520, [['ORG', 103, 147], ['ORGCF-8002', 181, 333], ['10/27', 410, 481], ['EXAMPLE', 501, 600], ['100MG', 620, 700], ['CAP', 718, 765], ["10's", 835, 898], ['311.16', 1263, 1343], ['399.00', 1400, 1480], ['5.00', 1615, 1659], ['622.32', 1755, 1824], ['21069099', 1838, 1939]]),
    ...row(580, [['ZYD', 106, 146], ['LVOCC2213', 182, 319], ['03/29', 409, 481], ['TESTPOWDER', 502, 683], ['COOL', 701, 765], ['CLASSIC', 784, 899], ['150GM', 939, 1007], ['131.80', 1264, 1343], ['155.00', 1402, 1480], ['Fk', 1553, 1575], ['5.00', 1615, 1659], ['395.40', 1755, 1824], ['30049011', 1838, 1938]]),
    ...row(640, [['WIN', 106, 146], ['*1317DNG', 182, 332], ['05/27', 409, 482], ['DEMO', 501, 582], ['GEL', 600, 650], ['15GM', 668, 740], ['@', 760, 775], ['10', 1085, 1115], ['10', 1185, 1215], ['28.75', 1277, 1343], ['65.63', 1402, 1480], ['5.00', 1615, 1659], ['287.50', 1755, 1824], ['30049069', 1838, 1938]]),
    ...row(700, [['@', 900, 930]]),                                                                               // a pen mark under the last row
    ...row(780, [['Total', 700, 800], ['23', 1000, 1040], ['Goods', 1500, 1600], ['Value', 1610, 1700], ['1618.90', 1800, 1900]]),
    ...row(830, [['Less', 1500, 1560], ['CD', 1570, 1610], ['4.00', 1620, 1680], ['%', 1690, 1700], ['64.76', 1800, 1880]]),
    ...row(880, [['Invoice', 1500, 1620], ['Amt.', 1630, 1700], ['1631.55', 1800, 1920]]),
    ...row(930, [['For', 1400, 1450], ['SAMPLE', 1460, 1560], ['DISTRIBUTORS', 1570, 1750], ['PVT.', 1760, 1810], ['LTD.', 1820, 1880]]),
  ];
}

describe('a scanned invoice read by OCR', () => {
  it('repairs a GSTIN with one misread character, and leaves a hopeless one alone', () => {
    const damaged = `${SCAN_SUPPLIER.slice(0, 11)}0${SCAN_SUPPLIER.slice(12)}`;
    expect(repairGstin(damaged, [SCAN_SUPPLIER])).toBe(SCAN_SUPPLIER);         // a vendor the business knows settles it
    expect([SCAN_SUPPLIER, null]).toContain(repairGstin(damaged));              // alone: the right one, or none, never a wrong one
    expect(repairGstin('33AAAAA0000A1ZZ')).not.toBe('garbage');
    expect(repairGstin('short')).toBeNull();
  });

  it('finds the table in a different column order, works dropped quantities out, and reads the footer', () => {
    const r = parseInvoice(toLines(scan()), { ownGstin: BUYER, knownGstins: [SCAN_SUPPLIER] });
    expect(r.tableFound).toBe(true);
    expect(r.header.invoiceno).toBe('IN55001');
    expect(r.header.suppliergstin).toBe(SCAN_SUPPLIER);
    expect(r.header.suppliername).toBe('SAMPLE DISTRIBUTORS PVT. LTD.');
    expect(r.header.printedtotal).toBe(1631.55);
    expect(r.header.goodsvalue).toBe(1618.9);
    expect(r.header.cashdiscount).toEqual({ pct: 4, amount: 64.76 });
    expect(r.lines).toHaveLength(4);
    expect(r.lines[0]).toMatchObject({ description: "SAMPLEFRESH 10MG TAB 15's", batch: 'ZLA26016', expdate: '2029-04-01', mrp: 137.23, qty: 3, rate: 104.56, tax: 5, amount: 313.68 });
    expect(r.lines[0].warnings.join(' ')).toContain('Quantity worked out');
    expect(r.lines[2]).toMatchObject({ description: 'TESTPOWDER COOL CLASSIC 150GM', qty: 3, mrp: 155, rate: 131.8 });   // "150GM" is the name, not the quantity
    expect(r.lines[3]).toMatchObject({ description: 'DEMO GEL 15GM', qty: 10, free: 10, rate: 28.75, amount: 287.5 });    // a pen mark is not part of the name
    expect(r.lines[3].warnings).toEqual([]);

    // the lines, with their tax and after the cash discount, come to the printed total
    const factor = cashFactor(r.lines, r.header);
    expect(factor).toBeCloseTo((1618.9 - 64.76) / 1618.9, 6);
    expect(Math.abs(linesTotalWithTax(r.lines, r.header) - 1631.55)).toBeLessThan(1);
  });

  it('does not take the word Date for the Rate column', () => {
    const r = parseInvoice(toLines(scan()), { ownGstin: BUYER });
    expect(r.lines[0].mrp).toBe(137.23);      // the MRP column was inferred, and the rate column did not swallow it
  });
});

describe('a digital invoice with a pack column and a totals row', () => {
  const w = (t: string, x0: number, x1: number, y: number): Word => ({ t, x0, x1, y0: y - 9, y1: y, page: 1 });
  const row = (y: number, cells: Array<[string, number, number]>) => cells.map(([t, a, b]) => w(t, a, b, y));
  const words = (): Word[] => [
    ...row(20, [['SAMPLE', 280, 340], ['DRUG', 345, 380], ['HOUSE', 385, 430]]),
    ...row(60, [['Invoice', 450, 495], ['No.', 498, 515], ['IN77001', 520, 575], ['Date', 600, 625], [':', 628, 631], ['20/10/26', 640, 690]]),
    ...row(100, [['MFR', 30, 52], ['HSN', 65, 85], ['BATCH', 125, 160], ['PRODUCT', 230, 285], ['NAME', 290, 320], ['PACK', 372, 402], ['EXP', 418, 440], ['QTY', 462, 482], ['FREE', 497, 522], ['RATE', 541, 575], ['MRP', 600, 625], ['DIS', 655, 675], ['GST', 690, 712], ['VALUE', 755, 795]]),
    // a blade: no pack, no expiry; its rate and MRP (3.24, 7.50) look like dates (3/2024, 7/2050) but are prices
    ...row(125, [['SUR', 33, 52], ['90189022', 63, 100], ['DO5018*', 123, 158], ['BLADE', 202, 235], ['11', 238, 250], ['SIZE', 253, 280], ["1'S", 303, 315], ['5', 470, 478], ['3.24', 552, 575], ['7.50', 610, 635], ['5.00', 697, 718], ['16.20', 755, 792]]),
    ...row(150, [['CIP', 33, 52], ['30049069', 63, 100], ['ICHT6361', 123, 168], ['SAMPLECIP', 202, 262], ['650', 265, 285], ['TAB', 288, 310], ["15'S", 372, 392], ['05/29', 418, 448], ['100', 464, 482], ['14.88', 548, 575], ['32.12', 604, 635], ['5.00', 697, 718], ['1488.00', 745, 792]]),
    ...row(175, [['CIP', 33, 52], ['30049099', 63, 100], ['5N40622*', 123, 168], ['EXAMPLE', 202, 255], ['50', 258, 270], ['TAB', 273, 295], ["4'S", 372, 385], ['08/28', 418, 448], ['5', 470, 478], ['10.25', 548, 575], ['137.25', 598, 635], ['5.00', 697, 718], ['51.25', 755, 792]]),
    // the totals row starts with a count, then Total: it ends the table
    ...row(300, [['#', 330, 338], ['20', 342, 354], ['Total', 385, 415], ['318', 470, 490], ['0', 520, 528], ['Goods', 600, 640], ['Value', 645, 680], ['1555.45', 745, 792]]),
    ...row(330, [['GST5%', 30, 62], ['278.31', 95, 130], ['278.31', 150, 190], ['0.00', 210, 235], ['1555.45', 265, 310], ['Add', 450, 470], ['GST', 475, 495], ['77.77', 745, 792]]),
    ...row(360, [['Invoice', 560, 620], ['Amt.', 625, 650], ['Rs', 680, 695], ['1,633.22', 700, 792]]),
  ];

  it('reads every row, none from the totals, and does not take a price for an expiry', () => {
    const r = parseInvoice(toLines(words()));
    expect(r.header.invoiceno).toBe('IN77001');
    expect(r.header.invoicedate).toBe('2026-10-20');
    expect(r.header.printedtotal).toBe(1633.22);
    expect(r.lines).toHaveLength(3);                                           // the totals row and what follows are not items
    expect(r.lines[0]).toMatchObject({ description: "BLADE 11 SIZE 1'S", batch: 'DO5018', expdate: null, mrp: 7.5, qty: 5, rate: 3.24, amount: 16.2 });
    expect(r.lines[0].warnings).toEqual(['No expiry read.']);                  // a blade has none: the product's "No expiry date" makes it ready
    expect(r.lines[2]).toMatchObject({ batch: '5N40622', expdate: '2028-08-01', mrp: 137.25, rate: 10.25, qty: 5, amount: 51.25 });
    expect(r.lines[2].warnings).toEqual([]);
  });
});
