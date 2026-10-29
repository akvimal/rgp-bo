import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { creditFor, creditNoteNo, fyLabel, invoiceNo } from './gst-tax';

/**
 * Tax documents on the sales side, taken inside the bill's own transaction so a bill that fails leaves no number used.
 *  - a completed bill of a registered business, dated on or after its go-live date, gets the next number of its financial year's series;
 *  - a settled return of such a bill gets a credit note at the bill's own rate;
 *  - an issued tax invoice cannot be changed: it is corrected by taking the goods back (a credit note) and making a new bill.
 */

export interface Registration { business_id: number; reg_type: 'none' | 'registered'; go_live: string | null; invoice_prefix: string; state_code: string | null; gstin: string | null }

export async function registrationOf(manager: EntityManager, businessId: number | null | undefined): Promise<Registration | null> {
  if (!businessId) return null;
  const [r] = await manager.query(
    `select r.business_id, r.reg_type, to_char(r.go_live, 'YYYY-MM-DD') as go_live, r.invoice_prefix, b.state_code, b.gstin
       from gst_registration r join business b on b.id = r.business_id where r.business_id = $1`, [businessId]);
  return r ? { ...r, business_id: +r.business_id } : null;
}

/** the number of the tax invoice for a completed bill, or null when the bill is not one (not registered, not yet live, not complete, already numbered) */
export async function assignGstInvoice(tm: EntityManager, saleId: number): Promise<string | null> {
  const [s] = await tm.query(
    `select s.id, s.status, to_char(s.bill_date, 'YYYY-MM-DD') as day, s.gst_invoice_no, s.place_of_supply, st.business_id
       from sale s left join stores st on st.id = s.store_id where s.id = $1`, [saleId]);
  if (!s) return null;
  if (s.gst_invoice_no) return s.gst_invoice_no;
  if (String(s.status || '').toUpperCase() !== 'COMPLETE') return null;
  const reg = await registrationOf(tm, s.business_id);
  if (!reg || reg.reg_type !== 'registered' || !reg.go_live || s.day < reg.go_live) return null;
  const [shut] = await tm.query(`select 1 from gst_filing_month where business_id = $1 and month = $2 and status = 'CLOSED'`, [reg.business_id, s.day.slice(0, 7)]);
  if (shut) throw new BadRequestException(`GST for ${s.day.slice(0, 7)} is closed (its return is filed), so a tax invoice cannot be dated in that month. Date the bill in an open month, or reopen the month under GST.`);
  const fy = fyLabel(s.day);
  const [n] = await tm.query(`select public.gst_next_no($1::int4, 'INV', $2) as n`, [reg.business_id, fy]);
  const no = invoiceNo(reg.invoice_prefix, fy, +n.n);
  await tm.query(
    `update sale set gst_invoice_no = $2, gst_business_id = $3, place_of_supply = coalesce(place_of_supply, $4) where id = $1`,
    [saleId, no, reg.business_id, reg.state_code]);
  return no;
}

/** a credit note for a settled return of a tax invoice; one per return, nothing for a bill that was not a tax invoice */
export async function issueCreditNote(tm: EntityManager, returnItemId: number, userId: number | null): Promise<string | null> {
  const [r] = await tm.query(
    `select ri.id, ri.qty, ri.accepted_qty, ri.status, si.id as sale_item_id, si.sale_id, si.qty as line_qty, si.total::float8 as line_total, coalesce(si.tax_pcnt, 0)::float8 as rate,
            s.gst_invoice_no, s.gst_business_id, to_char(s.bill_date, 'YYYY-MM-DD') as bill_day, s.place_of_supply, s.buyer_gstin, coalesce(s.disc_amount, 0)::float8 as disc,
            (select coalesce(sum(x.total), 0)::float8 from sale_item x where x.sale_id = s.id and x.active and not x.archive and x.qty > 0) as lines_total
       from sale_return_item ri join sale_item si on si.id = ri.sale_item_id join sale s on s.id = si.sale_id where ri.id = $1`, [returnItemId]);
  if (!r || !r.gst_invoice_no || !r.gst_business_id) return null;
  if (String(r.status || '').toUpperCase() !== 'ADJUSTED') return null;
  const [have] = await tm.query(`select note_no from gst_credit_note where return_item_id = $1`, [returnItemId]);
  if (have) return have.note_no;
  const qty = r.accepted_qty !== null && r.accepted_qty !== undefined ? Number(r.accepted_qty) : Number(r.qty);
  if (!(qty > 0)) return null;
  const c = creditFor(r.line_total, Number(r.line_qty), qty, r.rate, r.lines_total, r.disc);
  if (!(c.gross > 0)) return null;
  const day = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const fy = fyLabel(day);
  const [n] = await tm.query(`select public.gst_next_no($1::int4, 'CN', $2) as n`, [r.gst_business_id, fy]);
  const no = creditNoteNo(fy, +n.n);
  await tm.query(
    `insert into gst_credit_note (business_id, note_no, note_date, sale_id, sale_item_id, return_item_id, original_invoice_no, original_invoice_date, rate, qty, gross, taxable, tax, place_of_supply, buyer_gstin, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [r.gst_business_id, no, day, r.sale_id, r.sale_item_id, returnItemId, r.gst_invoice_no, r.bill_day, r.rate, qty, c.gross, c.taxable, c.tax, r.place_of_supply, r.buyer_gstin, userId]);
  return no;
}

const same = (a: any, b: any) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;

/** an issued tax invoice keeps its lines and its total; payment details and the like may still be corrected */
export async function assertIssuedBillUnchanged(manager: EntityManager, payload: any): Promise<void> {
  const id = Number(payload?.id);
  if (!id) return;
  const [s] = await manager.query(`select gst_invoice_no, buyer_gstin, status, total::float8 as total, coalesce(disc_amount, 0)::float8 as disc from sale where id = $1`, [id]);
  if (!s?.gst_invoice_no) return;
  const refuse = () => { throw new BadRequestException(`Bill ${s.gst_invoice_no} is a tax invoice and cannot be changed. Take the goods back (a credit note is issued) and make a new bill.`); };
  if (payload.status !== undefined && String(payload.status).toUpperCase() !== String(s.status).toUpperCase()) refuse();
  if (payload.total !== undefined && !same(payload.total, s.total)) refuse();
  if (payload.discamount !== undefined && !same(payload.discamount, s.disc)) refuse();
  if (payload.buyergstin !== undefined && String(payload.buyergstin || '').toUpperCase() !== String(s.buyer_gstin || '')) refuse();
  const current = await manager.query(`select id, qty, price::float8 as price, total::float8 as total, coalesce(tax_pcnt, 0)::float8 as rate from sale_item where sale_id = $1 and active and not archive`, [id]);
  const sent: any[] = Array.isArray(payload.items) ? payload.items : [];
  if (sent.length !== current.length) refuse();
  const byId = new Map<number, any>(current.map((c: any) => [+c.id, c]));
  for (const it of sent) {
    const c = byId.get(Number(it.id));
    if (!c) refuse();
    if (Number(it.qty) !== Number(c.qty) || !same(it.price, c.price) || !same(it.total, c.total) || !same(it.taxpcnt ?? c.rate, c.rate)) refuse();
  }
}
