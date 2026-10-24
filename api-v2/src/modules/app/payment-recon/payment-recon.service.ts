import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

import { isOwnerRole } from 'src/core/roles';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['VERIFIED', 'MISMATCH', 'NOT_FOUND'];
const WINDOW_MS = 15 * 60 * 1000;          // a payment and its bill are made within minutes of each other
const MAX_ROWS = 20000;
const round = (n: number) => Math.round(n * 100) / 100;
const last4 = (v: any) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);

/** a CSV as rows of cells; handles quotes, doubled quotes and line breaks inside quotes */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(x => x !== '')) out.push(row);
  return out;
}

/** Paytm's export wraps each value in apostrophes ('SUCCESS'); take them off, with the spaces around */
const clean = (v: any) => String(v ?? '').trim().replace(/^'+|'+$/g, '').trim();
const num = (v: any) => { const n = Number(clean(v).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };

/** "2026-09-01 10:15:00" (or with a T), kept as printed: it is compared with the bill time, which is stored the same way */
function stamp(v: any): string | null {
  const m = clean(v).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4].padStart(2, '0')}:${m[5]}:${m[6] || '00'}` : null;
}

interface Txn { txn_id: string; utr: string | null; rrn: string | null; kind: 'QR' | 'CARD'; mode: string | null; amount: number; settled_amount: number | null; fee: number | null; paid_on: string; settled_on: string | null }

/** the successful payments in a Paytm transaction report, and a count of what was left out */
export function readStatement(buf: Buffer, fileName = '') {
  if (!buf?.length) throw new BadRequestException('Choose the statement file.');
  if (/\.(xlsx?|pdf)$/i.test(fileName)) throw new BadRequestException('Upload the transaction report as a CSV file.');
  const table = parseCsv(buf.toString('utf8'));
  if (table.length < 2) throw new BadRequestException('The statement has no rows.');
  const head = table[0].map(h => clean(h).toLowerCase());
  const at = (...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    id: at('transaction_id'), amount: at('amount'), date: at('transaction_date'), status: at('status'), type: at('transaction_type'), request: at('request_type'),
    mode: at('payment_mode'), utr: at('utr_no.', 'utr_no'), rrn: at('rrn'), settledAmount: at('settled_amount'), settledOn: at('settled_date'), commission: at('commission'), gst: at('gst'),
  };
  if (c.id < 0 || c.amount < 0 || c.date < 0) throw new BadRequestException('This does not look like a Paytm transaction report: it needs Transaction_ID, Amount and Transaction_Date columns.');
  const get = (r: string[], i: number) => (i >= 0 ? clean(r[i]) : '');

  const txns: Txn[] = [];
  const left = { failed: 0, other: 0, unreadable: 0 };
  const seen = new Set<string>();
  let dupInFile = 0;
  for (const r of table.slice(1, MAX_ROWS + 1)) {
    const status = get(r, c.status).toUpperCase();
    if (c.status >= 0 && !['SUCCESS', 'TXN_SUCCESS'].includes(status)) { left.failed++; continue; }
    const type = get(r, c.type).toUpperCase();
    if (c.type >= 0 && type && type !== 'ACQUIRING') { left.other++; continue; }          // refunds and the like are not receipts
    const id = get(r, c.id), amount = num(r[c.amount]), paid = stamp(r[c.date]);
    if (!id || !(amount > 0) || !paid) { left.unreadable++; continue; }
    if (seen.has(id)) { dupInFile++; continue; }
    seen.add(id);
    const fee = c.commission >= 0 ? num(r[c.commission]) + (c.gst >= 0 ? num(r[c.gst]) || 0 : 0) : NaN;
    txns.push({
      txn_id: id.slice(0, 64), utr: get(r, c.utr).slice(0, 40) || null, rrn: get(r, c.rrn).slice(0, 30) || null,
      kind: get(r, c.request).toUpperCase() === 'EDC' ? 'CARD' : 'QR', mode: get(r, c.mode).slice(0, 30) || null,
      amount: round(amount), settled_amount: c.settledAmount >= 0 && Number.isFinite(num(r[c.settledAmount])) ? round(num(r[c.settledAmount])) : null,
      fee: Number.isFinite(fee) ? round(fee) : null, paid_on: paid, settled_on: stamp(r[c.settledOn]),
    });
  }
  if (!txns.length) throw new BadRequestException('The statement has no successful payments.');
  const days = txns.map(t => t.paid_on.slice(0, 10)).sort();
  return {
    txns, rows: table.length - 1, left, duplicates_in_file: dupInFile,
    from: days[0], to: days[days.length - 1], total: round(txns.reduce((t, x) => t + x.amount, 0)),
    qr: txns.filter(t => t.kind === 'QR').length, card: txns.filter(t => t.kind === 'CARD').length,
  };
}

/**
 * Suggest a statement payment for each unchecked bill. SURE: the same amount on the same day and the last 4 digits typed at
 * the till agree. LIKELY: no digits to go by, the same amount within 15 minutes, and neither the bill nor the payment has
 * another candidate. Anything less clear gets no suggestion; the person decides.
 */
export function suggest(bills: any[], txns: any[]) {
  const used = new Set<number>();
  const out = new Map<number, { txn: any; level: 'SURE' | 'LIKELY' }>();
  const when = (v: any) => +new Date(v);
  const same = (b: any, t: any) => Math.abs(b.amount - t.amount) <= 0.01;
  const free = (t: any) => !used.has(t.id) && !t.linked;

  for (const b of bills) {
    const l4 = last4(b.ref);
    if (!l4 || l4.length < 4) continue;
    const c = txns.filter(t => free(t) && same(b, t) && t.day === b.day && t.l4 === l4)
      .sort((x, y) => Math.abs(when(x.paid_on) - when(b.bill_date)) - Math.abs(when(y.paid_on) - when(b.bill_date)));
    if (c.length) { used.add(c[0].id); out.set(b.id, { txn: c[0], level: 'SURE' }); }
  }
  const open = bills.filter(b => !out.has(b.id));
  const near = (b: any) => txns.filter(t => free(t) && same(b, t) && Math.abs(when(t.paid_on) - when(b.bill_date)) <= WINDOW_MS);
  for (const b of open) {
    const c = near(b);
    if (c.length !== 1) continue;
    if (last4(b.ref) && last4(b.ref) !== c[0].l4) continue;                       // digits were typed and they disagree: not a match
    if (open.filter(o => o.id !== b.id && same(o, c[0]) && Math.abs(when(c[0].paid_on) - when(o.bill_date)) <= WINDOW_MS).length) continue;
    used.add(c[0].id); out.set(b.id, { txn: c[0], level: 'LIKELY' });
  }
  return out;
}

/**
 * Manual reconciliation of digital payments. Nothing calls Paytm: a person compares the bills with the Paytm / card
 * machine statement and records, bill by bill, whether the payment is there and for the right amount. An uploaded
 * transaction report only makes that quicker, by suggesting which payment belongs to which bill.
 */
@Injectable()
export class PaymentReconService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async scope(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id as number, all: isOwnerRole(r?.name), stores: s.map((x: any) => x.store_id) as number[] };
  }

  // ------------------------------------------------------------------ the statement
  /** what an uploaded report holds, before anything is kept */
  async preview(file: any) {
    const s = readStatement(file?.buffer, file?.originalname);
    const known = await this.manager.query(`select count(*)::int as n from payment_txn where txn_id = any($1::text[])`, [s.txns.map(t => t.txn_id)]);
    return { rows: s.rows, kept: s.txns.length, already_known: known[0].n, new: s.txns.length - known[0].n, left_out: s.left, duplicates_in_file: s.duplicates_in_file,
      from: s.from, to: s.to, total: s.total, qr: s.qr, card: s.card };
  }

  async importStatement(file: any, user: any) {
    const c = await this.scope(user);
    const s = readStatement(file?.buffer, file?.originalname);
    const id = await this.manager.transaction(async tm => {
      const [imp] = await tm.query(
        `insert into payment_import (file_name, row_count, uploaded_by) values ($1,$2,$3) returning id`, [String(file.originalname || '').slice(0, 150), s.rows, c.id]);
      let kept = 0, amount = 0;
      for (const t of s.txns) {
        const r = await tm.query(
          `insert into payment_txn (import_id, txn_id, utr, rrn, kind, mode, amount, settled_amount, fee, paid_on, settled_on) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (txn_id) do nothing returning id`, [imp.id, t.txn_id, t.utr, t.rrn, t.kind, t.mode, t.amount, t.settled_amount, t.fee, t.paid_on, t.settled_on]);
        if (r.length) { kept++; amount += t.amount; }
      }
      const left = s.left.failed + s.left.other + s.left.unreadable + s.duplicates_in_file;
      await tm.query(`update payment_import set rows_kept = $2, duplicates = $3, skipped = $4, total_amount = $5, period_from = $6, period_to = $7 where id = $1`,
        [imp.id, kept, s.txns.length - kept, left, round(amount), s.from, s.to]);
      return { id: imp.id as number, kept, duplicates: s.txns.length - kept, left_out: left };
    });
    await this.audit.record({ userId: c.id, action: 'payment_recon.statement_imported', entityType: 'payment_import', entityId: id.id,
      summary: `Payment statement ${file.originalname} imported: ${id.kept} payments${id.duplicates ? `, ${id.duplicates} already known` : ''}`, details: { from: s.from, to: s.to } });
    return { ...id, from: s.from, to: s.to };
  }

  statements() {
    return this.manager.query(
      `select i.id, i.file_name, i.row_count, i.rows_kept, i.duplicates, i.skipped, i.total_amount::float as total_amount, to_char(i.period_from, 'YYYY-MM-DD') as period_from,
              to_char(i.period_to, 'YYYY-MM-DD') as period_to, i.uploaded_on, u.full_name as by_name
         from payment_import i left join app_user u on u.id = i.uploaded_by order by i.uploaded_on desc, i.id desc limit 50`);
  }

  async removeStatement(id: number, user: any) {
    const c = await this.scope(user);
    const [i] = await this.manager.query(`select id, file_name from payment_import where id = $1`, [id]);
    if (!i) throw new NotFoundException('Statement not found.');
    await this.manager.query(`delete from payment_import where id = $1`, [id]);          // the checks stay; only their link to the payment goes
    await this.audit.record({ userId: c.id, action: 'payment_recon.statement_removed', entityType: 'payment_import', entityId: id, summary: `Payment statement ${i.file_name} removed`, details: {} });
    return { id };
  }

  // ------------------------------------------------------------------ the list
  /** bills in the period with their check and suggestion; for the Business Head also the day totals against the statement and payments with no bill */
  async list(q: any, user: any) {
    const c = await this.scope(user);
    const to = DATE.test(q?.to || '') ? q.to : new Date().toISOString().slice(0, 10);
    const from = DATE.test(q?.from || '') ? q.from : new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const args: any[] = [from, to];
    const where: string[] = [`s.status = 'COMPLETE'`, `s.active = true`, `coalesce(s.digi_amount, 0) > 0`, `s.bill_date::date between $1::date and $2::date`];
    if (!c.all) { args.push(c.stores.length ? c.stores : [0]); where.push(`s.store_id = any($${args.length}::int[])`); }
    if (q?.store && Number(q.store)) { args.push(Number(q.store)); where.push(`s.store_id = $${args.length}`); }
    if (q?.method === 'Card') where.push(`s.digi_method = 'Card'`);
    else if (q?.method === 'QR') where.push(`coalesce(s.digi_method, '') <> 'Card'`);
    const text = String(q?.q || '').trim();
    if (text) { args.push(`%${text}%`); where.push(`(s.bill_no::text ilike $${args.length} or s.digi_refno ilike $${args.length})`); }

    // every bill in the period (the state filter is applied after, so suggestions see all unchecked bills)
    const all = await this.manager.query(
      `select s.id, s.bill_no, s.bill_date, to_char(s.bill_date, 'YYYY-MM-DD') as day, s.store_id, st.location as store, s.digi_amount::float as amount, coalesce(s.digi_method, 'UPI') as method,
              s.digi_refno as ref, k.status as check_status, k.amount_seen::float as amount_seen, k.note, k.checked_on, u.full_name as checked_by, k.txn_id as linked_txn
         from sale s left join stores st on st.id = s.store_id
         left join payment_check k on k.sale_id = s.id left join app_user u on u.id = k.checked_by
        where ${where.join(' and ')}
        order by s.bill_date desc, s.id desc limit 1500`, args);

    const txns = await this.manager.query(
      `select t.id, t.txn_id, t.utr, t.kind, t.mode, t.amount::float as amount, t.paid_on, to_char(t.paid_on, 'YYYY-MM-DD') as day, right(t.txn_id, 4) as l4,
              exists (select 1 from payment_check k where k.txn_id = t.id) as linked
         from payment_txn t where t.paid_on >= $1::date - 1 and t.paid_on < $2::date + 2 order by t.paid_on`, [from, to]);

    const sug = suggest(all.filter((b: any) => !b.check_status), txns);
    const shown = (b: any) => {
      const s = String(q?.state || 'ALL').toUpperCase();
      if (s === 'PENDING') return !b.check_status;
      if (s === 'SUGGESTED') return !b.check_status && sug.has(b.id);
      return STATUSES.includes(s) ? b.check_status === s : true;
    };
    const rows = all.filter(shown).map((b: any) => {
      const m = sug.get(b.id);
      return { ...b, suggestion: m ? { level: m.level, txn_pk: m.txn.id, txn_id: m.txn.txn_id, mode: m.txn.mode, paid_on: m.txn.paid_on, kind: m.txn.kind } : null };
    });

    const sum = (a: any[]) => round(a.reduce((t, r) => t + (+r.amount || 0), 0));
    const part = (a: any[]) => ({ count: a.length, amount: sum(a) });
    const days = new Map<string, any>();
    for (const r of all) {
      const x = days.get(r.day) || { date: r.day, bills: 0, amount: 0, checked: 0, statement_count: 0, statement_amount: 0 };
      x.bills++; x.amount = round(x.amount + r.amount); if (r.check_status) x.checked++;
      days.set(r.day, x);
    }
    const full = c.all && !(q?.store && Number(q.store)) && !q?.method;                        // the statement covers the whole business
    let unbilled: any[] = [];
    if (full) {
      for (const t of txns.filter((t: any) => t.day >= from && t.day <= to)) {
        const x = days.get(t.day) || { date: t.day, bills: 0, amount: 0, checked: 0, statement_count: 0, statement_amount: 0 };
        x.statement_count++; x.statement_amount = round(x.statement_amount + t.amount); days.set(t.day, x);
      }
      const taken = new Set(Array.from(sug.values()).map(m => m.txn.id));
      unbilled = txns.filter((t: any) => t.day >= from && t.day <= to && !t.linked && !taken.has(t.id)).map((t: any) => ({ id: t.id, txn_id: t.txn_id, kind: t.kind, mode: t.mode, amount: t.amount, paid_on: t.paid_on })).slice(0, 500);
    }
    const unchecked = all.filter((b: any) => !b.check_status);
    return {
      from, to,
      summary: {
        bills: all.length, amount: sum(all),
        pending: part(unchecked), suggested: part(unchecked.filter((b: any) => sug.has(b.id))), sure: part(unchecked.filter((b: any) => sug.get(b.id)?.level === 'SURE')),
        verified: part(all.filter((b: any) => b.check_status === 'VERIFIED')), mismatch: part(all.filter((b: any) => b.check_status === 'MISMATCH')),
        not_found: part(all.filter((b: any) => b.check_status === 'NOT_FOUND')), unbilled: part(unbilled),
      },
      days: Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date)),
      rows, unbilled, hasStatement: txns.length > 0, canSeeStatement: c.all, truncated: all.length >= 1500,
    };
  }

  /** where each of these bills stands (the list of bills elsewhere in the app shows it and offers the check); only bills in stores the user can see */
  async statusOf(idsParam: any, user: any) {
    const ids = Array.from(new Set(String(idsParam || '').split(',').map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 500);
    if (!ids.length) return [];
    const c = await this.scope(user);
    return this.manager.query(
      `select k.sale_id, k.status, k.amount_seen::float as amount_seen, k.note, k.checked_on, u.full_name as checked_by
         from payment_check k join sale s on s.id = k.sale_id left join app_user u on u.id = k.checked_by
        where k.sale_id = any($1::int[]) and ($2::boolean or s.store_id = any($3::int[]))`, [ids, c.all, c.stores.length ? c.stores : [0]]);
  }

  /** a bill the user may check: a completed bill with a digital amount, in a store they can see */
  private async billFor(saleId: number, user: any) {
    const c = await this.scope(user);
    const [b] = await this.manager.query(
      `select id, bill_no, store_id, digi_amount::float as amount from sale where id = $1 and status = 'COMPLETE' and active = true and coalesce(digi_amount, 0) > 0`, [saleId]);
    if (!b) throw new NotFoundException('That bill has no digital payment to check.');
    if (!c.all && !c.stores.includes(b.store_id)) throw new ForbiddenException('That bill belongs to a store you do not work in.');
    return { b, c };
  }

  async record(saleId: number, body: any, user: any) {
    const status = String(body?.status || '').toUpperCase();
    if (!STATUSES.includes(status)) throw new BadRequestException('Choose Verified, Amount differs or Not on the statement.');
    const note = String(body?.note || '').trim().slice(0, 300);
    if (status !== 'VERIFIED' && !note) throw new BadRequestException('Add a note saying what the statement shows.');
    let seen: number | null = null;
    if (body?.amount_seen !== undefined && body?.amount_seen !== null && body.amount_seen !== '') {
      seen = Number(body.amount_seen);
      if (!Number.isFinite(seen) || seen < 0) throw new BadRequestException('The amount on the statement is not valid.');
    }
    if (status === 'MISMATCH' && seen === null) throw new BadRequestException('Enter the amount the statement shows.');
    const { b, c } = await this.billFor(saleId, user);
    let txnPk: number | null = null;
    if (body?.txn_pk !== undefined && body?.txn_pk !== null && status === 'VERIFIED') {
      const [t] = await this.manager.query(
        `select t.id, t.amount::float as amount, exists (select 1 from payment_check k where k.txn_id = t.id and k.sale_id <> $2) as taken from payment_txn t where t.id = $1`, [Number(body.txn_pk), saleId]);
      if (!t) throw new BadRequestException('That statement payment is no longer there.');
      if (t.taken) throw new BadRequestException('That statement payment is already checked against another bill.');
      if (Math.abs(t.amount - b.amount) > 0.5) throw new BadRequestException('The statement payment is for a different amount; mark the bill as "Amount differs" instead.');
      txnPk = t.id;
    }
    if (status === 'VERIFIED') seen = b.amount;
    if (status === 'NOT_FOUND') seen = null;
    await this.manager.query(
      `insert into payment_check (sale_id, status, amount_seen, note, txn_id, checked_by, checked_on) values ($1,$2,$3,$4,$5,$6,now())
       on conflict (sale_id) do update set status = excluded.status, amount_seen = excluded.amount_seen, note = excluded.note, txn_id = excluded.txn_id, checked_by = excluded.checked_by, checked_on = now()`,
      [saleId, status, seen, note || null, txnPk, c.id]);
    await this.audit.record({ userId: c.id, action: 'payment_recon.checked', entityType: 'sale', entityId: saleId,
      summary: `Bill ${b.bill_no ?? b.id}: digital payment ${status.toLowerCase().replace('_', ' ')}`, details: { status, amount: b.amount, seen, note, txn: txnPk } });
    return { id: saleId, status };
  }

  /** mark many bills verified at once (a whole day matched the statement); returns how many were set */
  async verifyMany(body: any, user: any) {
    const ids: number[] = Array.from(new Set((Array.isArray(body?.sale_ids) ? body.sale_ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0)));
    if (!ids.length) throw new BadRequestException('Select the bills to verify.');
    if (ids.length > 500) throw new BadRequestException('Verify at most 500 bills at a time.');
    const c = await this.scope(user);
    const ok = await this.manager.query(
      `select id, digi_amount::float as amount from sale where id = any($1::int[]) and status = 'COMPLETE' and active = true and coalesce(digi_amount, 0) > 0
          and ($2::boolean or store_id = any($3::int[]))`, [ids, c.all, c.stores.length ? c.stores : [0]]);
    for (const s of ok) {
      await this.manager.query(
        `insert into payment_check (sale_id, status, amount_seen, txn_id, checked_by, checked_on) values ($1,'VERIFIED',$2,null,$3,now())
         on conflict (sale_id) do update set status = 'VERIFIED', amount_seen = excluded.amount_seen, note = null, txn_id = null, checked_by = excluded.checked_by, checked_on = now()`, [s.id, s.amount, c.id]);
    }
    await this.audit.record({ userId: c.id, action: 'payment_recon.verified_many', entityType: 'sale', entityId: null,
      summary: `${ok.length} digital payment${ok.length === 1 ? '' : 's'} verified against the statement`, details: { sale_ids: ok.map((s: any) => s.id) } });
    return { verified: ok.length, skipped: ids.length - ok.length };
  }

  /**
   * Accept the suggestions for the period: verify each bill against its suggested payment. level SURE (default) takes only the
   * ones where the typed digits agree; ALL also takes the amount-and-time matches. Suggestions are worked out here, not trusted from the page.
   */
  async acceptSuggestions(body: any, user: any) {
    const level = String(body?.level || 'SURE').toUpperCase() === 'ALL' ? 'ALL' : 'SURE';
    const r = await this.list({ from: body?.from, to: body?.to, state: 'SUGGESTED', store: body?.store, method: body?.method }, user);
    const todo = r.rows.filter((b: any) => b.suggestion && (level === 'ALL' || b.suggestion.level === 'SURE'));
    const c = await this.scope(user);
    for (const b of todo) {
      await this.manager.query(
        `insert into payment_check (sale_id, status, amount_seen, txn_id, checked_by, checked_on) values ($1,'VERIFIED',$2,$3,$4,now())
         on conflict (sale_id) do nothing`, [b.id, b.amount, b.suggestion.txn_pk, c.id]);
    }
    await this.audit.record({ userId: c.id, action: 'payment_recon.suggestions_accepted', entityType: 'sale', entityId: null,
      summary: `${todo.length} digital payment${todo.length === 1 ? '' : 's'} verified from the statement (${level === 'ALL' ? 'all suggestions' : 'sure matches'})`, details: { from: r.from, to: r.to, sale_ids: todo.map((b: any) => b.id) } });
    return { verified: todo.length };
  }

  /** take a bill back to "still to check" */
  async clear(saleId: number, user: any) {
    const { b, c } = await this.billFor(saleId, user);
    await this.manager.query(`delete from payment_check where sale_id = $1`, [saleId]);
    await this.audit.record({ userId: c.id, action: 'payment_recon.cleared', entityType: 'sale', entityId: saleId, summary: `Bill ${b.bill_no ?? b.id}: digital payment check removed`, details: {} });
    return { id: saleId };
  }
}
