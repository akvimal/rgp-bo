/**
 * The GSTR-1 file for the GST Offline Tool / portal (JSON, version GST3.2.4), for the tables built so far: registered buyers (b2b) and their credit notes (cdnr), consumer sales (b2cs)
 * and nil-rated, exempt and non-GST supplies (nil). Pure: no framework, no database. The layout follows the offline tool's own sample import file.
 *
 *  b2b   tax invoices to buyers with a GSTIN, invoice by invoice under the buyer, one item per rate (0% lines are in nil, not here).
 *  cdnr  credit notes to buyers with a GSTIN, note by note under the buyer, one item per rate (0% is in nil, net of returns).
 *  b2cs  supplies to consumers (no GSTIN) that are not a large inter-state invoice, by place of supply and rate, net of credit notes to consumers.
 *  nil   the 0% supplies by kind, split by in-state / out-of-state and registered / consumer.
 *
 * Not built: b2cl, cdnur (notes against B2CL invoices), hsn, doc_issue. Their keys are written empty, so the file still loads; `notIncluded` says what the month has that
 * the file leaves out, so nobody files a month believing it is complete.
 */
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** an inter-state invoice to a consumer above this value goes in B2CL, not B2CS */
export const B2CL_LIMIT = 250000;

export const GSTR1_VERSION = 'GST3.2.4';

export interface JsonRate { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }
export interface JsonBill { docNo: string; date: string; buyerGstin: string | null; pos: string | null; inter: boolean; total: number; rates: JsonRate[] }
export interface JsonNote { noteNo: string; date: string; originalInvoiceNo: string | null; gross: number; buyerGstin: string | null; pos: string | null; inter: boolean; rate: number; taxable: number; cgst: number; sgst: number; igst: number }
export interface JsonNil { kind: 'NIL_RATED' | 'EXEMPT' | 'NON_GST'; buyer: 'B2B' | 'B2C'; place: 'INTRA' | 'INTER'; net: number }

export interface B2csRow { sply_ty: 'INTRA' | 'INTER'; rt: number; typ: 'OE'; pos: string; txval: number; camt?: number; samt?: number; iamt?: number; csamt: number }

export interface B2bItem { num: number; itm_det: { txval: number; rt: number; camt?: number; samt?: number; iamt?: number; csamt: number } }
export interface B2bInvoice { inum: string; idt: string; val: number; pos: string; rchrg: 'N'; inv_typ: 'R'; itms: B2bItem[] }
export interface CdnrNote { ntty: 'C'; nt_num: string; nt_dt: string; val: number; pos: string; rchrg: 'N'; inv_typ: 'R'; itms: B2bItem[] }
export interface CdnrBuyer { ctin: string; nt: CdnrNote[] }
export interface B2bBuyer { ctin: string; inv: B2bInvoice[] }

/** the portal's date: DD-MM-YYYY */
export const portalDate = (day: string) => `${day.slice(8, 10)}-${day.slice(5, 7)}-${day.slice(0, 4)}`;

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

  const large: string[] = [];
  const noteBuyers = new Map<string, Map<string, CdnrNote>>();
  let notesOfLarge = 0;
  const buyers = new Map<string, B2bInvoice[]>();
  for (const b of input.bills) {
    if (hasGstin(b.buyerGstin)) {
      const itms: B2bItem[] = b.rates.filter((r) => r.rate > 0).map((r) => ({
        // one item per rate; the tool numbers it rate x 100 + 1
        num: Math.round(r.rate * 100) + 1,
        itm_det: b.inter
          ? { txval: r2(r.taxable), rt: r.rate, iamt: r2(r.igst), csamt: 0 }
          : { txval: r2(r.taxable), rt: r.rate, camt: r2(r.cgst), samt: r2(r.sgst), csamt: 0 },
      }));
      if (!itms.length) continue;                      // only 0% lines: it is in nil
      const ctin = String(b.buyerGstin).trim().toUpperCase();
      const inv: B2bInvoice = { inum: b.docNo, idt: portalDate(b.date), val: r2(b.total), pos: posOf(b.pos, b.inter), rchrg: 'N', inv_typ: 'R', itms };
      buyers.set(ctin, [...(buyers.get(ctin) || []), inv]);
      continue;
    }
    if (b.inter && b.total > B2CL_LIMIT) { large.push(b.docNo); continue; }
    const pos = posOf(b.pos, b.inter);
    for (const r of b.rates) {
      if (!(r.rate > 0)) continue;                    // 0% supplies are in nil
      const c = slot(b.inter, pos, r.rate);
      c.txval += r.taxable; c.cgst += r.cgst; c.sgst += r.sgst; c.igst += r.igst;
    }
  }
  for (const n of input.notes) {
    if (hasGstin(n.buyerGstin)) {
      if (!(n.rate > 0)) continue;                     // a 0% note is taken off in nil
      const ctin = String(n.buyerGstin).trim().toUpperCase();
      const byNo = noteBuyers.get(ctin) || new Map<string, CdnrNote>();
      const note = byNo.get(n.noteNo) || { ntty: 'C' as const, nt_num: n.noteNo, nt_dt: portalDate(n.date), val: 0, pos: posOf(n.pos, n.inter), rchrg: 'N' as const, inv_typ: 'R' as const, itms: [] as B2bItem[] };
      const num = Math.round(n.rate * 100) + 1;
      let item = note.itms.find((t) => t.num === num);
      if (!item) { item = { num, itm_det: n.inter ? { txval: 0, rt: n.rate, iamt: 0, csamt: 0 } : { txval: 0, rt: n.rate, camt: 0, samt: 0, csamt: 0 } }; note.itms.push(item); }
      item.itm_det.txval = r2(item.itm_det.txval + n.taxable);
      if (n.inter) item.itm_det.iamt = r2((item.itm_det.iamt || 0) + n.igst);
      else { item.itm_det.camt = r2((item.itm_det.camt || 0) + n.cgst); item.itm_det.samt = r2((item.itm_det.samt || 0) + n.sgst); }
      note.val = r2(note.val + n.gross);
      byNo.set(n.noteNo, note); noteBuyers.set(ctin, byNo);
      continue;
    }
    if (n.originalInvoiceNo && large.includes(n.originalInvoiceNo)) { notesOfLarge++; continue; }     // against a B2CL invoice: that is CDNUR, not B2CS
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

  if (notesOfLarge) notIncluded.push(`${notesOfLarge} credit note line(s) against inter-state invoices above Rs 2,50,000 (CDNUR) are left out.`);
  if (large.length) notIncluded.push(`${large.length} inter-state invoice(s) to consumers above Rs 2,50,000 (B2CL) are left out: ${large.slice(0, 5).join(', ')}${large.length > 5 ? ' ...' : ''}.`);
  notIncluded.push('HSN summary and documents issued are not in this file yet.');

  // the keys and their order are those of the offline tool's own sample import file
  const b2b: B2bBuyer[] = Array.from(buyers.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ctin, inv]) => ({ ctin, inv: inv.sort((x, y) => x.inum.localeCompare(y.inum)) }));

  const cdnr: CdnrBuyer[] = Array.from(noteBuyers.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ctin, byNo]) => ({ ctin, nt: Array.from(byNo.values()).sort((x, y) => x.nt_num.localeCompare(y.nt_num)) }));

  const file = {
    gstin: input.gstin, fp: returnPeriod(input.month), version: GSTR1_VERSION, hash: 'hash',
    b2b, b2ba: [], b2cl: [], b2cla: [], b2cs, b2csa: [], nil: { inv },
    exp: [], expa: [], hsnSac: [], cdnra: [], at: [], ata: [], cdnr, cdnur: [], cdnura: [], atadj: [], atadja: [],
    doc_issue: { doc_det: [] }, hsn: { hsn_b2b: [], hsn_b2c: [] },
    supeco: { clttx: [], paytx: [] }, supecoa: { clttxa: [], paytxa: [] },
    ecom: { b2b: [], b2c: [], urp2b: [], urp2c: [] }, ecoma: { b2ba: [], b2ca: [], urp2ba: [], urp2ca: [] },
  };
  const b2bItems = b2b.flatMap((c) => c.inv.flatMap((i) => i.itms.map((t) => t.itm_det)));
  const cdnrItems = cdnr.flatMap((c) => c.nt.flatMap((n) => n.itms.map((t) => t.itm_det)));
  const totals = { cdnr_notes: cdnr.reduce((n, c) => n + c.nt.length, 0), cdnr_taxable: r2(cdnrItems.reduce((t, d) => t + d.txval, 0)), cdnr_tax: r2(cdnrItems.reduce((t, d) => t + (d.camt || 0) + (d.samt || 0) + (d.iamt || 0), 0)), b2b_invoices: b2b.reduce((n, c) => n + c.inv.length, 0), b2b_taxable: r2(b2bItems.reduce((t, d) => t + d.txval, 0)), b2b_tax: r2(b2bItems.reduce((t, d) => t + (d.camt || 0) + (d.samt || 0) + (d.iamt || 0), 0)), b2cs_taxable: r2(b2cs.reduce((s, r) => s + r.txval, 0)), b2cs_tax: r2(b2cs.reduce((s, r) => s + (r.camt || 0) + (r.samt || 0) + (r.iamt || 0), 0)), nil_total: r2(inv.reduce((s, r) => s + r.expt_amt + r.nil_amt + r.ngsup_amt, 0)) };
  return { file, notIncluded, totals };
}
