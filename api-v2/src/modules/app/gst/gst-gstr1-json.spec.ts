import { buildGstr1Json, returnPeriod } from './gst-gstr1-json';

const rate = (r: number, taxable: number, inter = false) => {
  const tax = Math.round(taxable * r) / 100;
  return inter ? { rate: r, taxable, cgst: 0, sgst: 0, igst: tax, tax } : { rate: r, taxable, cgst: tax / 2, sgst: tax / 2, igst: 0, tax };
};
const base = { gstin: '33AOBPV6363C2Z0', month: '2026-11', stateCode: '33' };

describe('GSTR-1 file: B2B, consumer sales and nil-rated', () => {
  it('writes the period as MMYYYY and keeps every table key so the tool loads it', () => {
    const { file } = buildGstr1Json({ ...base, bills: [], notes: [], nil: [] });
    expect(returnPeriod('2026-11')).toBe('112026');
    // the same keys, in the same order, as the offline tool's sample import file
    expect(Object.keys(file)).toEqual(['gstin', 'fp', 'version', 'hash', 'b2b', 'b2ba', 'b2cl', 'b2cla', 'b2cs', 'b2csa', 'nil', 'exp', 'expa', 'hsnSac', 'cdnra', 'at', 'ata', 'cdnr', 'cdnur', 'cdnura', 'atadj', 'atadja', 'doc_issue', 'hsn', 'supeco', 'supecoa', 'ecom', 'ecoma']);
    expect(file).toMatchObject({ gstin: '33AOBPV6363C2Z0', fp: '112026', version: 'GST3.2.4', b2cs: [], b2b: [], cdnr: [], hsn: { hsn_b2b: [], hsn_b2c: [] } });
    expect(file.nil.inv.map((r) => r.sply_ty)).toEqual(['INTRB2B', 'INTRAB2B', 'INTRB2C', 'INTRAB2C']);
  });

  it('adds consumer bills by place and rate, in-state as CGST and SGST', () => {
    const bills = [
      { docNo: 'A/1', date: '2026-11-05', buyerGstin: null, pos: '33', inter: false, total: 1050, rates: [rate(5, 1000)] },
      { docNo: 'A/2', date: '2026-11-05', buyerGstin: '', pos: null, inter: false, total: 590, rates: [rate(5, 1000), rate(18, 500)] },
    ];
    const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
    expect(file.b2cs).toEqual([
      { sply_ty: 'INTRA', rt: 5, typ: 'OE', pos: '33', txval: 2000, camt: 50, samt: 50, csamt: 0 },
      { sply_ty: 'INTRA', rt: 18, typ: 'OE', pos: '33', txval: 500, camt: 45, samt: 45, csamt: 0 },
    ]);
  });

  it('puts an inter-state consumer bill under its own state with IGST', () => {
    const bills = [{ docNo: 'A/3', date: '2026-11-05', buyerGstin: null, pos: '29', inter: true, total: 1120, rates: [rate(12, 1000, true)] }];
    const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
    expect(file.b2cs).toEqual([{ sply_ty: 'INTER', rt: 12, typ: 'OE', pos: '29', txval: 1000, iamt: 120, csamt: 0 }]);
  });

  it('nets credit notes to consumers off the same row, and drops a row that nets to nothing', () => {
    const bills = [{ docNo: 'A/1', date: '2026-11-05', buyerGstin: null, pos: '33', inter: false, total: 1050, rates: [rate(5, 1000), rate(18, 100)] }];
    const notes = [
      { noteNo: 'CN/1', date: '2026-11-07', originalInvoiceNo: 'A/1', gross: 0, buyerGstin: null, pos: '33', inter: false, rate: 5, taxable: 200, cgst: 5, sgst: 5, igst: 0 },
      { noteNo: 'CN/2', date: '2026-11-07', originalInvoiceNo: 'A/1', gross: 0, buyerGstin: null, pos: '33', inter: false, rate: 18, taxable: 100, cgst: 9, sgst: 9, igst: 0 },
    ];
    const { file, totals } = buildGstr1Json({ ...base, bills, notes, nil: [] });
    expect(file.b2cs).toEqual([{ sply_ty: 'INTRA', rt: 5, typ: 'OE', pos: '33', txval: 800, camt: 20, samt: 20, csamt: 0 }]);
    expect(totals).toMatchObject({ b2cs_taxable: 800, b2cs_tax: 40 });
  });

  it('keeps 0% lines out of b2cs, and says what the file leaves out', () => {
    const bills = [
      { docNo: 'A/1', date: '2026-11-05', buyerGstin: null, pos: '33', inter: false, total: 500, rates: [rate(0, 500)] },
      { docNo: 'A/2', date: '2026-11-05', buyerGstin: '29ABCDE1234F1Z5', pos: '29', inter: true, total: 1120, rates: [rate(12, 1000, true)] },
      { docNo: 'A/3', date: '2026-11-05', buyerGstin: null, pos: '29', inter: true, total: 300000, rates: [rate(12, 267857.14, true)] },
    ];
    const notes = [{ noteNo: 'CN/9', date: '2026-11-07', originalInvoiceNo: 'A/1', gross: 0, buyerGstin: '29ABCDE1234F1Z5', pos: '29', inter: true, rate: 12, taxable: 100, cgst: 0, sgst: 0, igst: 12 }];
    const { file, notIncluded } = buildGstr1Json({ ...base, bills, notes, nil: [] });
    expect(file.b2cs).toEqual([]);
    expect(file.b2b).toHaveLength(1);                                   // A/2 is in b2b now
    expect(file.cdnr).toHaveLength(1);                                  // and its note, which is not netted off the consumer sales
    expect(notIncluded.join(' ')).not.toMatch(/tax invoice\(s\) to buyers/);
    expect(notIncluded.join(' ')).toMatch(/A\/3/);
  });

  it('splits the nil table by kind and by in-state or out-of-state, registered or consumer, and nets returns', () => {
    const nil = [
      { kind: 'NIL_RATED' as const, buyer: 'B2C' as const, place: 'INTRA' as const, net: 1200.5 },
      { kind: 'EXEMPT' as const, buyer: 'B2C' as const, place: 'INTRA' as const, net: 300 },
      { kind: 'NON_GST' as const, buyer: 'B2C' as const, place: 'INTRA' as const, net: 40 },
      { kind: 'NIL_RATED' as const, buyer: 'B2B' as const, place: 'INTER' as const, net: 99.99 },
    ];
    const { file, totals } = buildGstr1Json({ ...base, bills: [], notes: [], nil });
    expect(file.nil.inv).toEqual([
      { sply_ty: 'INTRB2B', expt_amt: 0, nil_amt: 99.99, ngsup_amt: 0 },
      { sply_ty: 'INTRAB2B', expt_amt: 0, nil_amt: 0, ngsup_amt: 0 },
      { sply_ty: 'INTRB2C', expt_amt: 0, nil_amt: 0, ngsup_amt: 0 },
      { sply_ty: 'INTRAB2C', expt_amt: 300, nil_amt: 1200.5, ngsup_amt: 40 },
    ]);
    expect(totals.nil_total).toBe(1640.49);
  });

  describe('b2b', () => {
    const GSTIN_IN = '33PQRST6789U1Z4', GSTIN_OUT = '29FGHIJ5678K1Z9';

    it('lists an invoice under its buyer with the portal date, one item per rate, CGST and SGST in the state', () => {
      const bills = [{ docNo: 'DEM/26-27/000017', date: '2026-11-05', buyerGstin: GSTIN_IN, pos: '33', inter: false, total: 1176, rates: [rate(12, 1000), rate(5, 100)] }];
      const { file, totals } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
      expect(file.b2b).toEqual([{
        ctin: GSTIN_IN,
        inv: [{
          inum: 'DEM/26-27/000017', idt: '05-11-2026', val: 1176, pos: '33', rchrg: 'N', inv_typ: 'R',
          itms: [
            { num: 1201, itm_det: { txval: 1000, rt: 12, camt: 60, samt: 60, csamt: 0 } },
            { num: 501, itm_det: { txval: 100, rt: 5, camt: 2.5, samt: 2.5, csamt: 0 } },
          ],
        }],
      }]);
      expect(totals).toMatchObject({ b2b_invoices: 1, b2b_taxable: 1100, b2b_tax: 125 });
      expect(file.b2cs).toEqual([]);                                     // not a consumer sale
    });

    it('uses IGST and the state of the buyer for an inter-state invoice', () => {
      const bills = [{ docNo: 'A/9', date: '2026-11-30', buyerGstin: GSTIN_OUT, pos: '29', inter: true, total: 105, rates: [rate(5, 100, true)] }];
      const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
      expect(file.b2b[0].inv[0]).toMatchObject({ idt: '30-11-2026', pos: '29', itms: [{ num: 501, itm_det: { txval: 100, rt: 5, iamt: 5, csamt: 0 } }] });
      expect((file.b2b[0].inv[0].itms[0].itm_det as any).camt).toBeUndefined();
    });

    it('groups invoices by buyer and sorts them, and leaves out an invoice that has only 0% lines (that is nil)', () => {
      const bills = [
        { docNo: 'A/3', date: '2026-11-03', buyerGstin: GSTIN_OUT.toLowerCase(), pos: '29', inter: true, total: 105, rates: [rate(5, 100, true)] },
        { docNo: 'A/2', date: '2026-11-02', buyerGstin: GSTIN_IN, pos: '33', inter: false, total: 105, rates: [rate(5, 100)] },
        { docNo: 'A/1', date: '2026-11-01', buyerGstin: GSTIN_OUT, pos: '29', inter: true, total: 105, rates: [rate(5, 100, true)] },
        { docNo: 'A/4', date: '2026-11-04', buyerGstin: GSTIN_IN, pos: '33', inter: false, total: 500, rates: [rate(0, 500)] },
      ];
      const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
      expect(file.b2b.map((c) => c.ctin)).toEqual([GSTIN_OUT, GSTIN_IN]);      // sorted by GSTIN; the buyer's GSTIN is upper-cased
      expect(file.b2b[0].inv.map((i) => i.inum)).toEqual(['A/1', 'A/3']);
      expect(file.b2b[1].inv.map((i) => i.inum)).toEqual(['A/2']);
    });

    it('keeps every invoice number the portal accepts (at most 16 of letters, digits, - and /)', () => {
      const bills = [{ docNo: 'DEM/26-27/000008', date: '2026-11-05', buyerGstin: GSTIN_IN, pos: '33', inter: false, total: 105, rates: [rate(5, 100)] }];
      const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
      expect(file.b2b[0].inv[0].inum).toMatch(/^[a-zA-Z0-9\-/]{1,16}$/);
    });
  });

  describe('cdnr', () => {
    const GSTIN_IN = '33PQRST6789U1Z4', GSTIN_OUT = '29FGHIJ5678K1Z9';
    const note = (over: any = {}) => ({ noteNo: 'CN/26-27/000001', date: '2026-11-10', originalInvoiceNo: 'A/1', gross: 112, buyerGstin: GSTIN_OUT, pos: '29', inter: true, rate: 12, taxable: 100, cgst: 0, sgst: 0, igst: 12, ...over });

    it('lists a credit note to a buyer with a GSTIN under that buyer, as a credit note with its own date and value', () => {
      const { file, totals } = buildGstr1Json({ ...base, bills: [], notes: [note()], nil: [] });
      expect(file.cdnr).toEqual([{
        ctin: GSTIN_OUT,
        nt: [{ ntty: 'C', nt_num: 'CN/26-27/000001', nt_dt: '10-11-2026', val: 112, pos: '29', rchrg: 'N', inv_typ: 'R', itms: [{ num: 1201, itm_det: { txval: 100, rt: 12, iamt: 12, csamt: 0 } }] }],
      }]);
      expect(totals).toMatchObject({ cdnr_notes: 1, cdnr_taxable: 100, cdnr_tax: 12 });
      expect(file.b2cs).toEqual([]);                                     // not netted off the consumer sales
    });

    it('uses CGST and SGST for a note within the state, and one note with two rates has two items and the value of both', () => {
      const a = note({ buyerGstin: GSTIN_IN, pos: '33', inter: false, igst: 0, cgst: 6, sgst: 6, gross: 112 });
      const b = note({ buyerGstin: GSTIN_IN, pos: '33', inter: false, rate: 5, taxable: 200, igst: 0, cgst: 5, sgst: 5, gross: 210 });
      const { file } = buildGstr1Json({ ...base, bills: [], notes: [a, b], nil: [] });
      const n = file.cdnr[0].nt[0];
      expect(file.cdnr[0].nt).toHaveLength(1);
      expect(n.val).toBe(322);
      expect(n.itms).toEqual([
        { num: 1201, itm_det: { txval: 100, rt: 12, camt: 6, samt: 6, csamt: 0 } },
        { num: 501, itm_det: { txval: 200, rt: 5, camt: 5, samt: 5, csamt: 0 } },
      ]);
    });

    it('does not put a 0% note in cdnr (nil takes it off), and sorts buyers and notes', () => {
      const notes = [
        note({ noteNo: 'CN/2', buyerGstin: GSTIN_OUT }),
        note({ noteNo: 'CN/1', buyerGstin: GSTIN_OUT }),
        note({ noteNo: 'CN/3', buyerGstin: GSTIN_IN, pos: '33', inter: false, igst: 0, cgst: 6, sgst: 6 }),
        note({ noteNo: 'CN/4', buyerGstin: GSTIN_IN, rate: 0, taxable: 50, igst: 0, gross: 50 }),
      ];
      const { file } = buildGstr1Json({ ...base, bills: [], notes, nil: [] });
      expect(file.cdnr.map((c) => c.ctin)).toEqual([GSTIN_OUT, GSTIN_IN]);
      expect(file.cdnr[0].nt.map((x) => x.nt_num)).toEqual(['CN/1', 'CN/2']);
      expect(file.cdnr[1].nt.map((x) => x.nt_num)).toEqual(['CN/3']);
    });

    it('leaves a consumer note against a large inter-state invoice out of b2cs and says so', () => {
      const bills = [{ docNo: 'BIG/1', date: '2026-11-02', buyerGstin: null, pos: '29', inter: true, total: 300000, rates: [rate(12, 267857.14, true)] }];
      const notes = [note({ noteNo: 'CN/9', originalInvoiceNo: 'BIG/1', buyerGstin: null })];
      const { file, notIncluded } = buildGstr1Json({ ...base, bills, notes, nil: [] });
      expect(file.b2cs).toEqual([]);
      expect(file.cdnr).toEqual([]);
      expect(notIncluded.join(' ')).toMatch(/CDNUR/);
    });

    it('keeps a note number the portal accepts (at most 16 of letters, digits, - and /)', () => {
      const { file } = buildGstr1Json({ ...base, bills: [], notes: [note()], nil: [] });
      expect(file.cdnr[0].nt[0].nt_num).toMatch(/^[a-zA-Z0-9\-/]{1,16}$/);
    });
  });
});
