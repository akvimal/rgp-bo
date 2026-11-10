import { better, fromAi, impliedDiscount, judge, needsAssistant, parseMode, quantityFromAmount, textInstruction } from './invoice-ai';

/** what a model would record from the two scans checked on 10 Nov 2026 (the figures are the printed ones; a dropped quantity is left null, as it is told to) */
const PALEPU = {
  invoice_no: 'MG-26-182741', invoice_date: '2026-11-10', supplier_name: 'PALEPU PHARMA DISTRIBUTORS PRIVATE LIMITED', supplier_gstin: '33AAMCP7950M1ZS',
  printed_total: 4569, goods_value: 4484.97, cash_discount_amount: 133.46,
  lines: [
    { description: 'PACITANE 2MG TAB 30S', hsn: '30049099', batch: 'RH5318', expiry: '04/29', mrp: 43.77, qty: 1, rate: 35.94, discount_percent: null, gst_percent: 5, amount: 35.94 },
    { description: 'SIZODON MD 1MG 10TABS', hsn: '30049099', batch: 'SIH1397A', expiry: '06/28', mrp: 32.45, qty: null, rate: 24.72, discount_percent: 3, gst_percent: 5, amount: 74.16 },
    { description: 'INCIPRO ADVANCE VANILLA 400GM JAR', hsn: '21069099', batch: 'ZIAV011125', expiry: '04/27', mrp: 990, qty: null, rate: 785.71, discount_percent: 3, gst_percent: 5, amount: 3928.55 },
    { description: 'PANKAJA KASTHURI JAR 400GM', hsn: '30049011', batch: 'A057326', expiry: '06/28', mrp: 400, qty: 1, rate: 314.89, discount_percent: 3, gst_percent: 5, amount: 314.89 },
    { description: 'ANXIT 0.5MG TAB 15S', hsn: '30049089', batch: 'AXBS0112', expiry: '07/29', mrp: 57.5, qty: 3, rate: 43.81, discount_percent: 3, gst_percent: 5, amount: 131.43 },
  ],
};
const KANDAN = {
  invoice_no: '26-27D9056', invoice_date: '2026-11-10', supplier_name: 'SHRI KANDAN PHARMACEUTICALS', supplier_gstin: '33AEHFS0275G1Z5', printed_total: 1436,
  lines: [
    { description: 'INFLUVAC TETRA 0.5ML', hsn: '30024112', batch: 'P30', expiry: '07/27', mrp: 2950, qty: 1, rate: 1300, discount_percent: 0, gst_percent: 5, amount: 1365 },
    { description: 'ELOVAC-B 1ML', hsn: '30024112', batch: '25GHBV012', expiry: '06/28', mrp: 84.2, qty: 1, rate: 67.36, discount_percent: 0, gst_percent: 5, amount: 70.73 },
  ],
};

describe('reading an invoice with the assistant', () => {
  it('turns the Palepu reading into lines that agree with the printed total', () => {
    const r = fromAi(PALEPU)!;
    expect(r.rows).toBe(5);
    expect(r.derived).toBe(2);                                         // two quantities worked out from value / rate
    expect(r.parsed.lines.map((l) => l.qty)).toEqual([1, 3, 5, 1, 3]);
    expect(r.parsed.lines.map((l) => l.disc)).toEqual([0, 0, 0, 0, 0]); // the 3% is the cash discount at the foot, not a row discount
    expect(r.parsed.lines[0].expdate).toBe('2029-04-01');
    expect(r.parsed.header).toMatchObject({ invoiceno: 'MG-26-182741', invoicedate: '2026-11-10', suppliergstin: '33AAMCP7950M1ZS', printedtotal: 4569, cashdiscount: { pct: null, amount: 133.46 } });
    const c = judge(r.parsed);
    expect(c.tie.status).toBe('RECONCILED');
    expect(needsAssistant(c)).toBe(false);
    expect(r.parsed.lines[1].warnings.join(' ')).toMatch(/quantity was not read: 3/);
  });

  it('turns the Kandan reading into lines that agree with the printed total', () => {
    const r = fromAi(KANDAN)!;
    expect(r.rows).toBe(2);
    expect(r.derived).toBe(0);
    const c = judge(r.parsed);
    expect(c.tie.status).toBe('RECONCILED');
    expect(r.parsed.lines[0]).toMatchObject({ qty: 1, rate: 1300, disc: 0, tax: 5, amount: 1300, amountRead: 1365, batch: 'P30' });
  });

  it('does not accept a reading that disagrees with the invoice total', () => {
    const bad = JSON.parse(JSON.stringify(KANDAN));
    bad.lines[0].rate = 1800;                                           // a misread rate
    const c = judge(fromAi(bad)!.parsed);
    expect(c.tie.status).toBe('REVIEW');
    expect(needsAssistant(c)).toBe(true);
  });

  it('returns nothing when the model found no rows, and drops rows without a name', () => {
    expect(fromAi({ lines: [] })).toBeNull();
    expect(fromAi(null)).toBeNull();
    expect(fromAi({ lines: [{ qty: 1 }] })).toBeNull();
    expect(fromAi({ lines: [{ description: 'X', qty: 1, rate: 2 }, { qty: 3 }] })!.rows).toBe(1);
  });

  it('leaves out a date, GSTIN or expiry that is not valid, with a note for the expiry', () => {
    const r = fromAi({ invoice_date: 'someday', supplier_gstin: '33AAAAA0000A1Z', lines: [{ description: 'A', expiry: 'zz', qty: 1, rate: 1 }] })!;
    expect(r.parsed.header.invoicedate).toBeNull();
    expect(r.parsed.header.suppliergstin).toBeNull();
    expect(r.parsed.lines[0].expdate).toBeNull();
    expect(r.parsed.lines[0].warnings.join(' ')).toMatch(/expiry "zz"/);
  });

  it('reads dd/mm/yyyy dates and surfaces what the model was unsure of', () => {
    const r = fromAi({ invoice_date: '10/11/2026', lines: [{ description: 'A', qty: 1, rate: 1, unsure: ['batch'] }] })!;
    expect(r.parsed.header.invoicedate).toBe('2026-11-10');
    expect(r.parsed.lines[0].warnings.join(' ')).toMatch(/Hard to read: batch/);
  });

  it('works out a row discount from the printed amount, not from the model', () => {
    expect(impliedDiscount(2, 100, 5, 200, 3)).toBe(0);                // amount = qty x rate
    expect(impliedDiscount(2, 100, 5, 210, 3)).toBe(0);                // amount = qty x rate with tax
    expect(impliedDiscount(2, 100, 0, 194, 3)).toBe(3);                // a real 3% row discount
    expect(impliedDiscount(2, 100, 0, 180, null)).toBe(10);            // an unsaid one is found
    expect(impliedDiscount(null, 100, 0, 180, 4)).toBe(4);             // nothing to check against: as said
  });

  it('works out a missing quantity only when it comes out whole', () => {
    expect(quantityFromAmount(24.72, 5, 74.16)).toBe(3);
    expect(quantityFromAmount(785.71, 5, 3928.55)).toBe(5);
    expect(quantityFromAmount(1300, 5, 1365)).toBe(1);                 // the amount includes tax
    expect(quantityFromAmount(10, 0, 25)).toBeNull();
    expect(quantityFromAmount(null, 0, 25)).toBeNull();
  });

  it('prefers the reading that agrees with the total', () => {
    const good = judge(fromAi(KANDAN)!.parsed);
    const bad = JSON.parse(JSON.stringify(KANDAN)); bad.lines[0].rate = 1800;
    const worse = judge(fromAi(bad)!.parsed);
    const none = judge({ header: good.parsed.header, lines: [], warnings: [], tableFound: true });
    expect(better(worse, good)).toBe(good);
    expect(better(good, worse)).toBe(good);
    expect(better(none, worse)).toBe(worse);
    expect(better(good, none)).toBe(good);
    expect(needsAssistant(none)).toBe(true);
  });

  it('reads the mode setting, off unless it is text or full', () => {
    expect(parseMode('text')).toBe('text');
    expect(parseMode(' FULL ')).toBe('full');
    for (const v of ['off', '', 'on', null, undefined, 'yes']) expect(parseMode(v)).toBe('off');
  });

  it('puts the buyer\'s own GSTIN into the instruction and cuts very long text', () => {
    expect(textInstruction('x', '33ABCDE1234F1Z5')).toContain('33ABCDE1234F1Z5');
    expect(textInstruction('x'.repeat(50000), null).length).toBeLessThan(15000);
  });
});
