/**
 * The GSTR-1 file for the GST Offline Tool / portal (JSON, version GST3.2.4), for the tables built so far: consumer sales (b2cs) and nil-rated, exempt
 * and non-GST supplies (nil). Pure: no framework, no database. The layout follows the offline tool's own sample import file.
 *
 *  b2cs  supplies to consumers (no GSTIN) that are not a large inter-state invoice, by place of supply and rate, net of credit notes to consumers.
 *  nil   the 0% supplies by kind, split by in-state / out-of-state and registered / consumer.
 *
 * Not built: b2b, b2cl, cdnr, cdnur, hsn, doc_issue. Their keys are written empty, so the file still loads; `notIncluded` says what the month has that
 * the file leaves out, so nobody files a month believing it is complete.
 */
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** an inter-state invoice to a consumer above this value goes in B2CL, not B2CS */
export const B2CL_LIMIT = 250000;

export const GSTR1_VERSION = 'GST3.2.4';

export interface JsonRate { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }
export interface JsonBill { docNo: string; buyerGstin: string | null; pos: string | null; inter: boolean; total: number; rates: JsonRate[] }
export interface JsonNote { noteNo: string; buyerGstin: string | null; pos: string | null; inter: boolean; rate: number; taxable: number; cgst: number; sgst: number; igst: number }
export interface JsonNil { kind: 'NIL_RATED' | 'EXEMPT' | 'NON_GST'; buyer: 'B2B' | 'B2C'; place: 'INTRA' | 'INTER'; net: number }

export interface B2csRow { sply_ty: 'INTRA' | 'INTER'; rt: number; typ: 'OE'; pos: string; txval: number; camt?: number; samt?: number; iamt?: number; csamt: number }

const hasGstin = (g: string | null | undefined) => !!String(g ?? '').trim();

/** `MMYYYY` of a `YYYY-MM` month */
export const returnPeriod = (month: string) => `${month.slice(5, 7)}${month.slice(0, 4)}`;

export function buildGstr1Json(input: { gstin: string; month: string; stateCode: string; bills: JsonBill[]; notes: JsonNote[]; nil: JsonNil[] }) {
  const own = String(input.stateCode || input.gstin.slice(0, 2));
  const posOf = (p: string | null, inter: boolean) => (inter ? String(p ?? '').trim() : own) || own;
  const notIncluded: string[] = [];

  const acc = new Map<string, { sply: 'INTRA' | 'INTER'; rt: number; pos: string; txval: number; cgst: number; sgst: number; igst: number }>();
  const slot = (inter: boolean, pos: string, rt: number) => {
    const key = `${inter ? 'INTER' : 'INTRA'}|${pos}|${rt}`;
    let c = acc.get(key);
    if (!c) { c = { sply: inter ? 'INTER' : 'INTRA', rt, pos, txval: 0, cgst: 0, sgst: 0, igst: 0 }; acc.set(key, c); }
    return c;
  };

  let registeredBills = 0, registeredNotes = 0;
  const large: string[] = [];
  for (const b of input.bills) {
    if (hasGstin(b.buyerGstin)) { registeredBills++; continue; }
    if (b.inter && b.total > B2CL_LIMIT) { large.push(b.docNo); continue; }
    const pos = posOf(b.pos, b.inter);
    for (const r of b.rates) {
      if (!(r.rate > 0)) continue;                    // 0% supplies are in nil
      const c = slot(b.inter, pos, r.rate);
      c.txval += r.taxable; c.cgst += r.cgst; c.sgst += r.sgst; c.igst += r.igst;
    }
  }
  for (const n of input.notes) {
    if (hasGstin(n.buyerGstin)) { registeredNotes++; continue; }
    if (!(n.rate > 0)) continue;
    const c = slot(n.inter, posOf(n.pos, n.inter), n.rate);
    c.txval -= n.taxable; c.cgst -= n.cgst; c.sgst -= n.sgst; c.igst -= n.igst;
  }

  const b2cs: B2csRow[] = Array.from(acc.values())
    .filter((c) => r2(c.txval) !== 0 || r2(c.cgst + c.sgst + c.igst) !== 0)
    .sort((a, b) => a.sply.localeCompare(b.sply) || a.pos.localeCompare(b.pos) || a.rt - b.rt)
    .map((c) => c.sply === 'INTRA'
      ? { sply_ty: 'INTRA' as const, rt: c.rt, typ: 'OE' as const, pos: c.pos, txval: r2(c.txval), camt: r2(c.cgst), samt: r2(c.sgst), csamt: 0 }
      : { sply_ty: 'INTER' as const, rt: c.rt, typ: 'OE' as const, pos: c.pos, txval: r2(c.txval), iamt: r2(c.igst), csamt: 0 });

  const types: Array<{ ty: string; buyer: 'B2B' | 'B2C'; place: 'INTRA' | 'INTER' }> = [
    { ty: 'INTRB2B', buyer: 'B2B', place: 'INTER' }, { ty: 'INTRAB2B', buyer: 'B2B', place: 'INTRA' },
    { ty: 'INTRB2C', buyer: 'B2C', place: 'INTER' }, { ty: 'INTRAB2C', buyer: 'B2C', place: 'INTRA' },
  ];
  const inv = types.map((t) => {
    const rows = input.nil.filter((n) => n.buyer === t.buyer && n.place === t.place);
    const sum = (k: JsonNil['kind']) => r2(rows.filter((n) => n.kind === k).reduce((s, n) => s + n.net, 0));
    return { sply_ty: t.ty, expt_amt: sum('EXEMPT'), nil_amt: sum('NIL_RATED'), ngsup_amt: sum('NON_GST') };
  });

  if (registeredBills) notIncluded.push(`${registeredBills} tax invoice(s) to buyers with a GSTIN (B2B) are not in this file: key them in the tool, or wait for the B2B table.`);
  if (registeredNotes) notIncluded.push(`${registeredNotes} credit note(s) to buyers with a GSTIN (CDNR) are not in this file.`);
  if (large.length) notIncluded.push(`${large.length} inter-state invoice(s) to consumers above Rs 2,50,000 (B2CL) are left out: ${large.slice(0, 5).join(', ')}${large.length > 5 ? ' ...' : ''}.`);
  notIncluded.push('HSN summary and documents issued are not in this file yet.');

  // the keys and their order are those of the offline tool's own sample import file
  const file = {
    gstin: input.gstin, fp: returnPeriod(input.month), version: GSTR1_VERSION, hash: 'hash',
    b2b: [], b2ba: [], b2cl: [], b2cla: [], b2cs, b2csa: [], nil: { inv },
    exp: [], expa: [], hsnSac: [], cdnra: [], at: [], ata: [], cdnr: [], cdnur: [], cdnura: [], atadj: [], atadja: [],
    doc_issue: { doc_det: [] }, hsn: { hsn_b2b: [], hsn_b2c: [] },
    supeco: { clttx: [], paytx: [] }, supecoa: { clttxa: [], paytxa: [] },
    ecom: { b2b: [], b2c: [], urp2b: [], urp2c: [] }, ecoma: { b2ba: [], b2ca: [], urp2ba: [], urp2ca: [] },
  };
  const totals = { b2cs_taxable: r2(b2cs.reduce((s, r) => s + r.txval, 0)), b2cs_tax: r2(b2cs.reduce((s, r) => s + (r.camt || 0) + (r.samt || 0) + (r.iamt || 0), 0)), nil_total: r2(inv.reduce((s, r) => s + r.expt_amt + r.nil_amt + r.ngsup_amt, 0)) };
  return { file, notIncluded, totals };
}
