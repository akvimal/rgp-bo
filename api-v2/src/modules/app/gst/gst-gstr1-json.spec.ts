import { buildGstr1Json, returnPeriod } from './gst-gstr1-json';

const rate = (r: number, taxable: number, inter = false) => {
  const tax = Math.round(taxable * r) / 100;
  return inter ? { rate: r, taxable, cgst: 0, sgst: 0, igst: tax, tax } : { rate: r, taxable, cgst: tax / 2, sgst: tax / 2, igst: 0, tax };
};
const base = { gstin: '33AOBPV6363C2Z0', month: '2026-11', stateCode: '33' };

describe('GSTR-1 file: consumer sales and nil-rated', () => {
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
      { docNo: 'A/1', buyerGstin: null, pos: '33', inter: false, total: 1050, rates: [rate(5, 1000)] },
      { docNo: 'A/2', buyerGstin: '', pos: null, inter: false, total: 590, rates: [rate(5, 1000), rate(18, 500)] },
    ];
    const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
    expect(file.b2cs).toEqual([
      { sply_ty: 'INTRA', rt: 5, typ: 'OE', pos: '33', txval: 2000, camt: 50, samt: 50, csamt: 0 },
      { sply_ty: 'INTRA', rt: 18, typ: 'OE', pos: '33', txval: 500, camt: 45, samt: 45, csamt: 0 },
    ]);
  });

  it('puts an inter-state consumer bill under its own state with IGST', () => {
    const bills = [{ docNo: 'A/3', buyerGstin: null, pos: '29', inter: true, total: 1120, rates: [rate(12, 1000, true)] }];
    const { file } = buildGstr1Json({ ...base, bills, notes: [], nil: [] });
    expect(file.b2cs).toEqual([{ sply_ty: 'INTER', rt: 12, typ: 'OE', pos: '29', txval: 1000, iamt: 120, csamt: 0 }]);
  });

  it('nets credit notes to consumers off the same row, and drops a row that nets to nothing', () => {
    const bills = [{ docNo: 'A/1', buyerGstin: null, pos: '33', inter: false, total: 1050, rates: [rate(5, 1000), rate(18, 100)] }];
    const notes = [
      { noteNo: 'CN/1', buyerGstin: null, pos: '33', inter: false, rate: 5, taxable: 200, cgst: 5, sgst: 5, igst: 0 },
      { noteNo: 'CN/2', buyerGstin: null, pos: '33', inter: false, rate: 18, taxable: 100, cgst: 9, sgst: 9, igst: 0 },
    ];
    const { file, totals } = buildGstr1Json({ ...base, bills, notes, nil: [] });
    expect(file.b2cs).toEqual([{ sply_ty: 'INTRA', rt: 5, typ: 'OE', pos: '33', txval: 800, camt: 20, samt: 20, csamt: 0 }]);
    expect(totals).toMatchObject({ b2cs_taxable: 800, b2cs_tax: 40 });
  });

  it('keeps 0% lines out of b2cs and says what the file leaves out', () => {
    const bills = [
      { docNo: 'A/1', buyerGstin: null, pos: '33', inter: false, total: 500, rates: [rate(0, 500)] },
      { docNo: 'A/2', buyerGstin: '29ABCDE1234F1Z5', pos: '29', inter: true, total: 1120, rates: [rate(12, 1000, true)] },
      { docNo: 'A/3', buyerGstin: null, pos: '29', inter: true, total: 300000, rates: [rate(12, 267857.14, true)] },
    ];
    const notes = [{ noteNo: 'CN/9', buyerGstin: '29ABCDE1234F1Z5', pos: '29', inter: true, rate: 12, taxable: 100, cgst: 0, sgst: 0, igst: 12 }];
    const { file, notIncluded } = buildGstr1Json({ ...base, bills, notes, nil: [] });
    expect(file.b2cs).toEqual([]);
    expect(notIncluded.join(' ')).toMatch(/1 tax invoice\(s\) to buyers with a GSTIN/);
    expect(notIncluded.join(' ')).toMatch(/1 credit note\(s\)/);
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
});
