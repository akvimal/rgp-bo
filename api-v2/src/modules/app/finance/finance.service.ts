import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { ModulesService } from 'src/core/modules/modules.service';
import { businessOfUser } from 'src/core/business-of-user';
import { Mapping, Parsed } from './statement-parser';
import { readStatement } from './statement-file';
import {
  TAGS, TAG_LABEL, REASONS, bridge, channel, classify, dedupeKeys, isExpenseTag, isIncomeTag, monthBounds, signoffProblems, vendorMatch, within, UserRule,
} from './finance-rules';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const text = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const isDay = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const isMonth = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}(-01)?$/.test(v);

/**
 * Finance for the Business Head: bank accounts (business or store level), statements from any bank, each line tagged and matched to the books where it
 * can be, the books compared with the bank month by month (a difference up to the tolerance is accepted, a larger one needs a reason), and the records
 * check for the retention period.
 */
@Injectable()
export class FinanceService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly modules: ModulesService) {}

  private async business(user: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    if (!businessId) throw new ForbiddenException('Your account is not placed in a business.');
    const stores = (await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [businessId]))
      .map((s: any) => ({ id: +s.id, location: String(s.location).trim() }));
    return { businessId, stores };
  }

  async tolerance(): Promise<number> {
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = 'bank_recon_tolerance' and active and not archive limit 1`);
    const n = Number(s?.setting_value);
    return Number.isFinite(n) && n >= 0 ? n : 100;
  }

  private async account(user: any, id: number) {
    const { businessId } = await this.business(user);
    const [a] = await this.manager.query(`select a.*, s.location as store from bank_account a left join stores s on s.id = a.store_id where a.id = $1 and a.business_id = $2`, [id, businessId]);
    if (!a) throw new NotFoundException('That bank account was not found.');
    return a;
  }

  // ------------------------------------------------------------------ accounts
  async accounts(user: any) {
    const { businessId, stores } = await this.business(user);
    const rows = await this.manager.query(
      `select a.id, a.name, a.bank_name, a.last4, a.store_id, s.location as store, a.opening_balance::float as opening_balance, to_char(a.opening_date, 'YYYY-MM-DD') as opening_date, a.active, (a.mapping is not null) as mapped,
              (select count(*)::int from bank_txn t where t.account_id = a.id) as lines,
              (select count(*)::int from bank_txn t where t.account_id = a.id and t.status = 'UNEXPLAINED') as unexplained,
              (select to_char(min(t.txn_date), 'YYYY-MM-DD') from bank_txn t where t.account_id = a.id) as first_line,
              (select to_char(max(t.txn_date), 'YYYY-MM-DD') from bank_txn t where t.account_id = a.id) as last_line
         from bank_account a left join stores s on s.id = a.store_id where a.business_id = $1 order by a.active desc, a.name`, [businessId]);
    return { accounts: rows, stores, tolerance: await this.tolerance(), tags: TAGS.map((t) => ({ tag: t, label: TAG_LABEL[t] })), reasons: REASONS };
  }

  async saveAccount(user: any, id: number | null, b: any) {
    const { businessId, stores } = await this.business(user);
    const name = text(b?.name, 80);
    if (!name) throw new BadRequestException('Give the account a name.');
    const storeId = Number(b?.store_id) || null;
    if (storeId && !stores.some((s) => s.id === storeId)) throw new BadRequestException('That store is not in your business.');
    const last4 = text(b?.last4, 40);
    if (last4 && !/^\d{1,4}$/.test(last4)) throw new BadRequestException('Give only the last four digits of the account number.');
    const opening = b?.opening_balance === undefined || b?.opening_balance === null || b?.opening_balance === '' ? null : Number(b.opening_balance);
    if (opening !== null && !Number.isFinite(opening)) throw new BadRequestException('The opening balance must be a number.');
    const openingDate = isDay(b?.opening_date) ? b.opening_date : null;
    if (id) {
      await this.account(user, id);
      await this.manager.query(`update bank_account set name = $2, bank_name = $3, last4 = $4, store_id = $5, opening_balance = $6, opening_date = $7, active = $8 where id = $1`,
        [id, name, text(b?.bank_name, 60), last4, storeId, opening, openingDate, b?.active !== false]);
    } else {
      const [r] = await this.manager.query(
        `insert into bank_account (business_id, store_id, name, bank_name, last4, opening_balance, opening_date, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [businessId, storeId, name, text(b?.bank_name, 60), last4, opening, openingDate, user.id]);
      id = r.id;
      await this.audit.record({ userId: user.id, action: 'finance.account_added', entityType: 'bank_account', entityId: id, summary: `Bank account ${name} added`, details: { store_id: storeId } });
    }
    return { id };
  }

  // ------------------------------------------------------------------ reading a statement
  private override(b: any): Partial<Mapping> | undefined {
    if (!b) return undefined;
    let o = b;
    if (typeof b === 'string') { try { o = JSON.parse(b); } catch { return undefined; } }
    if (!o || typeof o !== 'object') return undefined;
    const out: Partial<Mapping> = {};
    if (Number.isInteger(o.headerRow)) out.headerRow = o.headerRow;
    if (typeof o.delimiter === 'string' && o.delimiter.length === 1) out.delimiter = o.delimiter;
    if (Array.isArray(o.columns)) out.columns = o.columns;
    if (typeof o.dateFormat === 'string') out.dateFormat = o.dateFormat;
    return out;
  }

  private async read(a: any, file: { buffer: Buffer; originalname: string } | undefined, override: any): Promise<Parsed> {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a statement file.');
    const ov = this.override(override) ?? (a.mapping ? (a.mapping as Partial<Mapping>) : undefined);
    try {
      const first = await readStatement(file.buffer, file.originalname, this.override(override));
      if (first.recognised || !ov || override) return first;
      return await readStatement(file.buffer, file.originalname, ov);       // the columns this account used before
    } catch (e: any) {
      throw new BadRequestException('This file could not be read as a statement: ' + String(e?.message || e).slice(0, 120));
    }
  }

  private async existingKeys(accountId: number, keys: string[]): Promise<Set<string>> {
    if (!keys.length) return new Set();
    const rows = await this.manager.query(`select dedupe_key from bank_txn where account_id = $1 and dedupe_key = any($2::text[])`, [accountId, keys]);
    return new Set(rows.map((r: any) => String(r.dedupe_key).trim()));
  }

  /** what the file holds and what would be new, before anything is kept */
  async preview(user: any, accountId: number, file: any, override: any) {
    const a = await this.account(user, accountId);
    const p = await this.read(a, file, override);
    const keys = p.rows.length ? dedupeKeys(p.rows.map((r) => ({ ...r }))) : [];
    const have = await this.existingKeys(a.id, keys);
    const [last] = await this.manager.query(`select balance::float as balance, to_char(txn_date, 'YYYY-MM-DD') as day from bank_txn where account_id = $1 order by txn_date desc, id desc limit 1`, [a.id]);
    return {
      recognised: p.recognised, mapping: p.mapping, header: p.header, sample: p.sample, warnings: p.warnings, skipped: p.skipped, meta: p.meta,
      roles: ['date', 'valueDate', 'narration', 'debit', 'credit', 'amount', 'type', 'ref', 'balance', 'ignore'],
      rows: p.rows.length, duplicates: keys.filter((k) => have.has(k)).length, fresh: keys.filter((k) => !have.has(k)).length,
      first: p.rows.slice(0, 8), last, gap: this.gapNote(a, last, p),
    };
  }

  private gapNote(a: any, last: { balance: number | null; day: string } | undefined, p: Parsed): string | null {
    if (!p.rows.length || p.meta.opening === null) return null;
    if (last && last.balance !== null && p.meta.from && p.meta.from > last.day && Math.abs(last.balance - p.meta.opening) > 0.01) {
      return `The account ended at ${r2(last.balance).toFixed(2)} on ${last.day}, and this statement opens at ${p.meta.opening.toFixed(2)}: lines between them may be missing.`;
    }
    if (!last && a.opening_balance !== null && a.opening_balance !== undefined && a.opening_date && p.meta.from && p.meta.from >= String(a.opening_date).slice(0, 10)
      && Math.abs(Number(a.opening_balance) - p.meta.opening) > 0.01 && p.meta.from === String(a.opening_date).slice(0, 10)) {
      return `The opening balance you gave is ${Number(a.opening_balance).toFixed(2)}, and this statement opens at ${p.meta.opening.toFixed(2)}.`;
    }
    return null;
  }

  // ------------------------------------------------------------------ importing
  async importFile(user: any, accountId: number, file: any, override: any) {
    const a = await this.account(user, accountId);
    const { businessId } = await this.business(user);
    const p = await this.read(a, file, override);
    if (!p.recognised) throw new BadRequestException(p.warnings[0] || 'The columns of this file were not recognised.');
    if (!p.rows.length) throw new BadRequestException('No transactions were found in this file.');
    const tol = await this.tolerance();
    const keys = dedupeKeys(p.rows.map((r) => ({ ...r })));
    const have = await this.existingKeys(a.id, keys);
    const fresh = p.rows.map((r, i) => ({ r, key: keys[i] })).filter((x) => !have.has(x.key));
    const [last] = await this.manager.query(`select balance::float as balance, to_char(txn_date, 'YYYY-MM-DD') as day from bank_txn where account_id = $1 order by txn_date desc, id desc limit 1`, [a.id]);
    const gap = this.gapNote(a, last, p);

    const rules: UserRule[] = await this.manager.query(`select pattern, direction, tag, vendor_id, expense_category from bank_rule where business_id = $1 and active order by id desc`, [businessId]);
    const vendors = (await this.manager.query(`select id, business_name, legal_name from vendor where active and not archive`)).map((v: any) => ({ id: +v.id, names: [v.business_name, v.legal_name].filter(Boolean) }));
    const used = await this.usedMatches(businessId);

    const stats = { matched: 0, tagged: 0, unexplained: 0 };
    const importId = await this.manager.transaction(async (m) => {
      const [imp] = await m.query(
        `insert into bank_import (account_id, file_name, rows_total, rows_new, rows_duplicate, period_from, period_to, opening, closing, continuity_breaks, gap_note, uploaded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [a.id, text(file.originalname, 150), p.rows.length, fresh.length, p.rows.length - fresh.length, p.meta.from, p.meta.to, p.meta.opening, p.meta.closing, p.meta.breaks.length, gap, user.id]);
      for (const { r, key } of fresh) {
        const c = classify(r.narration, r.debit, r.credit, rules);
        let tag = c.tag, vendorId = c.vendorId ?? null, category = c.category, status = tag ? 'TAGGED' : 'UNEXPLAINED';
        let reason = c.reason, matchKind: string | null = null, matchId: number | null = null;
        if (r.debit > 0) {
          if (!vendorId) vendorId = vendorMatch(c.counterparty, vendors);
          if (!tag && vendorId) { tag = 'VENDOR_PAYMENT'; status = 'TAGGED'; reason = 'The payee matches a vendor'; }
          const hit = await this.matchBooks(m, businessId, r, tol, used, tag === 'VENDOR_PAYMENT' || !tag ? vendorId : null);
          if (hit) { matchKind = hit.kind; matchId = hit.id; status = 'MATCHED'; tag = hit.tag; vendorId = hit.vendorId ?? vendorId; category = hit.category ?? category; reason = hit.reason; used.add(hit.kind + ':' + hit.id); }
        } else if (r.credit > 0 && r.ref) {
          const [px] = await m.query(`select id from payment_txn where upper(utr) = upper($1) limit 1`, [r.ref]);
          if (px && !used.has('PAYTM_UTR:' + px.id)) { matchKind = 'PAYTM_UTR'; matchId = px.id; status = 'MATCHED'; tag = tag || 'DIGITAL_SETTLEMENT'; reason = 'Matches a payment report settlement by its reference'; used.add('PAYTM_UTR:' + px.id); }
        }
        if (status === 'MATCHED') stats.matched++; else if (status === 'TAGGED') stats.tagged++; else stats.unexplained++;
        await m.query(
          `insert into bank_txn (account_id, import_id, txn_date, value_date, narration, ref, debit, credit, balance, kind, counterparty, dedupe_key, tag, vendor_id, expense_category, status, match_kind, match_id, reason)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [a.id, imp.id, r.date, r.valueDate, r.narration, text(r.ref, 40), r.debit, r.credit, r.balance, c.kind, c.counterparty, key, tag, vendorId, category, status, matchKind, matchId, reason]);
      }
      if (p.mapping) await m.query(`update bank_account set mapping = $2::jsonb where id = $1`, [a.id, JSON.stringify(p.mapping)]);
      return imp.id;
    });
    await this.audit.record({
      userId: user.id, action: 'finance.bank_import', entityType: 'bank_account', entityId: a.id,
      summary: `Bank statement imported for ${a.name}: ${fresh.length} new line${fresh.length === 1 ? '' : 's'} (${p.meta.from} to ${p.meta.to})`,
      details: { file: file.originalname, rows: p.rows.length, fresh: fresh.length, breaks: p.meta.breaks.length },
    });
    return { importId, rows: p.rows.length, fresh: fresh.length, duplicates: p.rows.length - fresh.length, from: p.meta.from, to: p.meta.to, opening: p.meta.opening, closing: p.meta.closing, breaks: p.meta.breaks.length, gap, ...stats, warnings: p.warnings };
  }

  /** books records already claimed by a bank line, so one payment is never matched twice */
  private async usedMatches(businessId: number): Promise<Set<string>> {
    const rows = await this.manager.query(
      `select t.match_kind, t.match_id from bank_txn t join bank_account a on a.id = t.account_id where a.business_id = $1 and t.match_id is not null`, [businessId]);
    return new Set(rows.map((r: any) => `${r.match_kind}:${r.match_id}`));
  }

  /** a payment out, matched to a vendor payment (by its reference, or by amount and date) or to a non-cash expense */
  private async matchBooks(m: EntityManager, businessId: number, r: { date: string; debit: number; ref: string }, tol: number, used: Set<string>, vendorId: number | null) {
    const ref = String(r.ref || '').trim();
    const usable = ref && !/^0+$/.test(ref);
    if (usable) {
      const rows = await m.query(`select id, vendor_id, amount::float as amount from vendor_payment where active and not archive and upper(trans_ref) = upper($1)`, [ref]);
      const hit = rows.find((x: any) => Math.abs(x.amount - r.debit) <= tol && !used.has('VENDOR_PAY:' + x.id));
      if (hit) return { kind: 'VENDOR_PAY', id: hit.id, tag: 'VENDOR_PAYMENT', vendorId: hit.vendor_id, category: null, reason: 'Matches a vendor payment by its reference' };
    }
    const vp = (await m.query(
      `select id, vendor_id from vendor_payment where active and not archive and pay_date between $1::date - 7 and $1::date + 7 and abs(amount - $2) <= $3 and ($4::int is null or vendor_id = $4)`,
      [r.date, r.debit, tol, vendorId])).filter((x: any) => !used.has('VENDOR_PAY:' + x.id));
    if (vp.length === 1) return { kind: 'VENDOR_PAY', id: vp[0].id, tag: 'VENDOR_PAYMENT', vendorId: vp[0].vendor_id, category: null, reason: 'Matches a vendor payment of this amount and week' };
    const ex = (await m.query(
      `select e.id, c.name as category from expense e join expense_category c on c.id = e.category_id
        where e.status = 'APPROVED' and upper(e.pay_mode) <> 'CASH' and e.expense_date between $1::date - 7 and $1::date + 7 and abs(e.amount - $2) <= $3`,
      [r.date, r.debit, tol])).filter((x: any) => !used.has('EXPENSE:' + x.id));
    if (ex.length === 1) return { kind: 'EXPENSE', id: ex[0].id, tag: 'EXPENSE', vendorId: null, category: ex[0].category, reason: 'Matches an expense of this amount and week' };
    return null;
  }

  async imports(user: any, accountId: number) {
    await this.account(user, accountId);
    return this.manager.query(
      `select i.id, i.file_name, i.rows_total, i.rows_new, i.rows_duplicate, to_char(i.period_from, 'YYYY-MM-DD') as period_from, to_char(i.period_to, 'YYYY-MM-DD') as period_to,
              i.opening::float as opening, i.closing::float as closing, i.continuity_breaks, i.gap_note, i.uploaded_on, u.full_name as by_name
         from bank_import i left join app_user u on u.id = i.uploaded_by where i.account_id = $1 order by i.id desc limit 40`, [accountId]);
  }

  // ------------------------------------------------------------------ the lines
  async lines(user: any, q: any) {
    const { businessId } = await this.business(user);
    const args: any[] = [businessId];
    const where = ['a.business_id = $1'];
    if (+q.account) { args.push(+q.account); where.push(`t.account_id = $${args.length}`); }
    if (isDay(q.from)) { args.push(q.from); where.push(`t.txn_date >= $${args.length}::date`); }
    if (isDay(q.to)) { args.push(q.to); where.push(`t.txn_date <= $${args.length}::date`); }
    if (['UNEXPLAINED', 'TAGGED', 'MATCHED'].includes(String(q.status))) { args.push(q.status); where.push(`t.status = $${args.length}`); }
    if (q.tag && TAGS.includes(String(q.tag))) { args.push(q.tag); where.push(`t.tag = $${args.length}`); }
    if (String(q.direction) === 'DEBIT') where.push('t.debit > 0'); else if (String(q.direction) === 'CREDIT') where.push('t.credit > 0');
    const search = text(q.q, 60);
    if (search) { args.push('%' + search.toUpperCase() + '%'); where.push(`(upper(t.narration) like $${args.length} or upper(coalesce(t.ref, '')) like $${args.length})`); }
    const limit = Math.min(Math.max(+q.limit || 300, 1), 1000);
    const rows = await this.manager.query(
      `select t.id, t.account_id, to_char(t.txn_date, 'YYYY-MM-DD') as txn_date, t.narration, t.ref, t.debit::float as debit, t.credit::float as credit, t.balance::float as balance, t.kind, t.counterparty,
              t.tag, t.vendor_id, v.business_name as vendor, t.expense_category, t.status, t.match_kind, t.reason, t.note
         from bank_txn t join bank_account a on a.id = t.account_id left join vendor v on v.id = t.vendor_id
        where ${where.join(' and ')} order by t.txn_date desc, t.id desc limit ${limit}`, args);
    const [tot] = await this.manager.query(
      `select count(*)::int as n, coalesce(sum(t.debit), 0)::float as debit, coalesce(sum(t.credit), 0)::float as credit,
              count(*) filter (where t.status = 'UNEXPLAINED')::int as unexplained
         from bank_txn t join bank_account a on a.id = t.account_id where ${where.join(' and ')}`, args);
    return { rows, total: tot, vendors: await this.vendorList(), categories: (await this.manager.query(`select name from expense_category where active order by display_order, name`)).map((c: any) => c.name) };
  }

  private vendorList() { return this.manager.query(`select id, business_name as name from vendor where active and not archive order by business_name`); }

  /** say what a line is; optionally remember it, so the same kind of line is tagged next time (and the matching lines already there now) */
  async tagLine(user: any, id: number, b: any) {
    const { businessId } = await this.business(user);
    const [t] = await this.manager.query(
      `select t.* from bank_txn t join bank_account a on a.id = t.account_id where t.id = $1 and a.business_id = $2`, [id, businessId]);
    if (!t) throw new NotFoundException('That bank line was not found.');
    const tag = b?.tag === null || b?.tag === '' ? null : String(b?.tag);
    if (tag !== null && !TAGS.includes(tag)) throw new BadRequestException('Choose what this line is.');
    const incoming = Number(t.credit) > 0;
    if (tag && incoming && isExpenseTag(tag)) throw new BadRequestException('Money that came in cannot be an expense.');
    if (tag && !incoming && isIncomeTag(tag)) throw new BadRequestException('Money that went out cannot be income.');
    let category: string | null = null;
    if (tag === 'EXPENSE' && b?.category) {
      const [c] = await this.manager.query(`select name from expense_category where lower(name) = lower($1) and active`, [String(b.category)]);
      if (!c) throw new BadRequestException('Choose one of the expense categories.');
      category = c.name;
    }
    const vendorId = tag === 'VENDOR_PAYMENT' && Number(b?.vendor_id) ? Number(b.vendor_id) : null;
    if (vendorId) {
      const [v] = await this.manager.query(`select id from vendor where id = $1`, [vendorId]);
      if (!v) throw new BadRequestException('That vendor was not found.');
    }
    const note = text(b?.note, 200);
    await this.manager.query(
      `update bank_txn set tag = $2, expense_category = $3, vendor_id = $4, note = $5, status = $6, match_kind = null, match_id = null, reason = $7, tagged_by = $8, tagged_on = now() where id = $1`,
      [id, tag, category, vendorId, note, tag ? 'TAGGED' : 'UNEXPLAINED', tag ? 'Tagged by a person' : null, user.id]);

    let others = 0;
    const pattern = text(b?.pattern, 80) || t.counterparty;
    if (tag && b?.remember && pattern && String(pattern).trim().length >= 4) {
      const direction = incoming ? 'CREDIT' : 'DEBIT';
      await this.manager.query(
        `insert into bank_rule (business_id, pattern, direction, tag, vendor_id, expense_category, created_by) values ($1,$2,$3,$4,$5,$6,$7)`,
        [businessId, String(pattern).trim(), direction, tag, vendorId, category, user.id]);
      const r = await this.manager.query(
        `update bank_txn x set tag = $3, expense_category = $4, vendor_id = $5, status = 'TAGGED', reason = $6, tagged_by = $7, tagged_on = now()
           from bank_account a where a.id = x.account_id and a.business_id = $1 and x.status = 'UNEXPLAINED' and x.id <> $8 and upper(x.narration) like $2
            and ((x.credit > 0 and $9 = 'CREDIT') or (x.debit > 0 and $9 = 'DEBIT')) returning x.id`,
        [businessId, '%' + String(pattern).trim().toUpperCase() + '%', tag, category, vendorId, 'Your rule: ' + pattern, user.id, id, direction]);
      others = r.length;
    }
    await this.audit.record({ userId: user.id, action: 'finance.bank_tagged', entityType: 'bank_txn', entityId: id, summary: `Bank line tagged ${tag ? TAG_LABEL[tag] : '(cleared)'}${others ? `, and ${others} like it` : ''}`, details: { tag, vendorId, category, remembered: !!b?.remember } });
    return { id, updated: others };
  }

  async rules(user: any) {
    const { businessId } = await this.business(user);
    return this.manager.query(
      `select r.id, r.pattern, r.direction, r.tag, r.vendor_id, v.business_name as vendor, r.expense_category, r.active from bank_rule r left join vendor v on v.id = r.vendor_id where r.business_id = $1 order by r.id desc`, [businessId]);
  }

  async removeRule(user: any, id: number) {
    const { businessId } = await this.business(user);
    const r = await this.manager.query(`delete from bank_rule where id = $1 and business_id = $2 returning id`, [id, businessId]);
    if (!r.length) throw new NotFoundException('That rule was not found.');
    return { id };
  }

  // ------------------------------------------------------------------ the month: the bank against the books
  async month(user: any, accountId: number, monthIn: string) {
    if (!isMonth(monthIn)) throw new BadRequestException('Give the month as year-month, for example 2026-09.');
    const a = await this.account(user, accountId);
    const tol = await this.tolerance();
    const { start, next } = monthBounds(monthIn);
    const lines = await this.manager.query(
      `select id, to_char(txn_date, 'YYYY-MM-DD') as txn_date, narration, debit::float as debit, credit::float as credit, balance::float as balance, tag, status, vendor_id
         from bank_txn where account_id = $1 and txn_date >= $2::date and txn_date < $3::date order by txn_date, id`, [a.id, start, next]);
    const credits = r2(lines.reduce((s: number, l: any) => s + l.credit, 0));
    const debits = r2(lines.reduce((s: number, l: any) => s + l.debit, 0));
    const first = lines[0], lastLine = lines[lines.length - 1];
    const opening = first && first.balance !== null ? r2(first.balance + first.debit - first.credit) : null;
    const closing = lastLine && lastLine.balance !== null ? lastLine.balance : null;
    const [prev] = await this.manager.query(`select balance::float as balance from bank_txn where account_id = $1 and txn_date < $2::date order by txn_date desc, id desc limit 1`, [a.id, start]);
    const br = opening !== null && closing !== null ? bridge(opening, credits, debits, closing) : null;
    const carry = prev && prev.balance !== null && opening !== null ? r2(opening - prev.balance) : null;

    // the books, for the same store (or the whole business)
    const store = a.store_id ?? null;
    const sales = async (col: string, shiftDays: number) => (await this.manager.query(
      `select coalesce(sum(${col}), 0)::float as v from sale where status = 'COMPLETE' and bill_date >= ($1::date + $4::int) and bill_date < ($2::date + $4::int) and ($3::int is null or store_id = $3)`, [start, next, store, shiftDays]))[0].v;
    const tagSum = async (tag: string, col: 'credit' | 'debit') => (await this.manager.query(`select coalesce(sum(${col}), 0)::float as v from bank_txn where account_id = $1 and tag = $2 and txn_date >= $3::date and txn_date < $4::date`, [a.id, tag, start, next]))[0].v;
    const [vp] = await this.manager.query(`select coalesce(sum(amount), 0)::float as v from vendor_payment where active and not archive and pay_date >= $1::date and pay_date < $2::date`, [start, next]);
    const [ex] = await this.manager.query(
      `select coalesce(sum(amount), 0)::float as v from expense where status = 'APPROVED' and upper(pay_mode) <> 'CASH' and expense_date >= $1::date and expense_date < $2::date and ($3::int is null or store_id = $3)`, [start, next, store]);
    const channels = [
      // card and UPI money reaches the bank about a day after the sale
      { ...channel('digital', 'Card / UPI sales and settlements', await sales('coalesce(digi_amount, 0)', -1), await tagSum('DIGITAL_SETTLEMENT', 'credit'), tol), hint: 'Settlements arrive about a day after the sale, so the books are taken from the day before the month starts to the day before it ends.' },
      { ...channel('cash', 'Cash sales and cash deposited', await sales('coalesce(cash_amount, 0)', 0), await tagSum('CASH_DEPOSIT', 'credit'), tol), hint: 'Cash not yet banked, or spent in cash, shows here as a difference.' },
      { ...channel('vendors', 'Vendor payments', vp.v, await tagSum('VENDOR_PAYMENT', 'debit'), tol), hint: 'The books have the payments you recorded; the bank has the payments made.' },
      { ...channel('expenses', 'Expenses paid from the bank', ex.v, await tagSum('EXPENSE', 'debit'), tol), hint: 'Approved expenses paid by bank, UPI, card or cheque.' },
    ];
    const counts = { total: lines.length, unexplained: 0, tagged: 0, matched: 0, unexplainedAmount: 0 };
    for (const l of lines) {
      if (l.status === 'UNEXPLAINED') { counts.unexplained++; counts.unexplainedAmount = r2(counts.unexplainedAmount + l.debit + l.credit); } else if (l.status === 'TAGGED') counts.tagged++; else counts.matched++;
    }
    const [so] = await this.manager.query(
      `select s.id, s.signed_on, s.note, s.snapshot, u.full_name as by_name from bank_signoff s join app_user u on u.id = s.signed_by where s.account_id = $1 and s.month = $2::date`, [a.id, start]);
    return {
      account: { id: a.id, name: a.name, store: a.store, store_id: a.store_id }, month: start, today: istDay(), over: istDay() >= next, tolerance: tol,
      // the bank's own balance has to add up exactly: the tolerance is for the books against the bank, not for missing lines
      bridge: br && { opening, credits, debits, closing, ...br, within: within(br.difference, 0.01), carry, carryWithin: carry === null ? true : within(carry, 0.01) },
      channels, counts, signoff: so ?? null, reasons: REASONS,
      unexplained: lines.filter((l: any) => l.status === 'UNEXPLAINED').slice(0, 60),
    };
  }

  async signoff(user: any, accountId: number, monthIn: string, body: any) {
    const m = await this.month(user, accountId, monthIn);
    if (m.signoff) throw new BadRequestException('This month is already signed.');
    if (!m.over) throw new BadRequestException('The month is not over yet.');
    if (!m.counts.total) throw new BadRequestException('There are no bank lines for this month.');
    const problems = signoffProblems(m.channels, body?.reasons);
    if (m.bridge && !m.bridge.within) problems.push(`The balances do not add up: the closing balance is ${m.bridge.difference.toFixed(2)} away from the opening balance plus the lines. Lines may be missing from the statement.`);
    if (m.bridge && !m.bridge.carryWithin) problems.push(`This month opens ${Math.abs(m.bridge.carry as number).toFixed(2)} away from where the previous statement ended. Lines may be missing between them.`);
    const note = text(body?.note, 300);
    if (m.counts.unexplainedAmount > m.tolerance + 1e-9 && !(body?.acceptUnexplained && note && note.length >= 5)) {
      problems.push(`${m.counts.unexplained} bank line${m.counts.unexplained === 1 ? ' is' : 's are'} still unexplained (${m.counts.unexplainedAmount.toFixed(2)}). Tag them, or accept them with a note.`);
    }
    if (problems.length) throw new BadRequestException(problems.join(' '));
    const snapshot = { bridge: m.bridge, channels: m.channels.map((c: any) => ({ ...c, reason: body?.reasons?.[c.key] ?? null })), counts: m.counts, acceptedUnexplained: !!body?.acceptUnexplained };
    const [row] = await this.manager.query(`insert into bank_signoff (account_id, month, signed_by, note, snapshot) values ($1, $2::date, $3, $4, $5::jsonb) returning id`, [accountId, m.month, user.id, note, JSON.stringify(snapshot)]);
    await this.audit.record({ userId: user.id, action: 'finance.month_signed', entityType: 'bank_account', entityId: accountId, summary: `Bank reconciliation signed: ${m.account.name}, ${m.month.slice(0, 7)}`, details: { channels: snapshot.channels.map((c: any) => ({ key: c.key, difference: c.difference, reason: c.reason?.code ?? null })) } });
    return { id: row.id };
  }

  async reopen(user: any, accountId: number, monthIn: string, body: any) {
    if (!isMonth(monthIn)) throw new BadRequestException('Give the month as year-month.');
    await this.account(user, accountId);
    const why = text(body?.reason, 200);
    if (!why) throw new BadRequestException('Say why the month is being opened again.');
    const { start } = monthBounds(monthIn);
    const r = await this.manager.query(`delete from bank_signoff where account_id = $1 and month = $2::date returning id`, [accountId, start]);
    if (!r.length) throw new NotFoundException('That month is not signed.');
    await this.audit.record({ userId: user.id, action: 'finance.month_reopened', entityType: 'bank_account', entityId: accountId, summary: `Bank reconciliation reopened for ${start.slice(0, 7)}: ${why}`, details: { reason: why } });
    return { ok: true };
  }

  async signedMonths(user: any, accountId: number) {
    await this.account(user, accountId);
    return this.manager.query(
      `select to_char(s.month, 'YYYY-MM') as month, s.signed_on, u.full_name as by_name, s.note from bank_signoff s join app_user u on u.id = s.signed_by where s.account_id = $1 order by s.month desc limit 60`, [accountId]);
  }

  // ------------------------------------------------------------------ income and expenses
  async overview(user: any, q: any) {
    const { businessId, stores } = await this.business(user);
    const to = isDay(q.to) ? q.to : istDay();
    const from = isDay(q.from) ? q.from : addDays(to, -29);
    if (from > to) throw new BadRequestException('The period starts after it ends.');
    if (Date.parse(to) - Date.parse(from) > 800 * 86400000) throw new BadRequestException('Choose a period of at most two years.');
    const storeId = Number(q.storeid) || null;
    if (storeId && !stores.some((s) => s.id === storeId)) throw new BadRequestException('That store is not in your business.');
    const accountId = Number(q.account) || null;
    const next = addDays(to, 1);

    const [s] = await this.manager.query(
      `select count(*)::int as bills, coalesce(sum(total), 0)::float as total, coalesce(sum(cash_amount), 0)::float as cash, coalesce(sum(digi_amount), 0)::float as digital,
              coalesce(sum(credit_amount), 0)::float as credit, coalesce(sum(staff_credit_amount), 0)::float as staff_credit
         from sale where status = 'COMPLETE' and bill_date >= $1::date and bill_date < $2::date and ($3::int is null or store_id = $3)`, [from, next, storeId]);
    const [pu] = await this.manager.query(
      `select count(*)::int as invoices, coalesce(sum(total), 0)::float as total from purchase_invoice where status = 'COMPLETE' and active and not archive and invoice_date >= $1::date and invoice_date < $2::date and ($3::int is null or store_id = $3)`, [from, next, storeId]);
    const [vp] = await this.manager.query(`select coalesce(sum(amount), 0)::float as total from vendor_payment where active and not archive and pay_date >= $1::date and pay_date < $2::date`, [from, next]);
    const exp = await this.manager.query(
      `select c.name as category, coalesce(sum(e.amount), 0)::float as total, count(*)::int as n from expense e join expense_category c on c.id = e.category_id
        where e.status = 'APPROVED' and e.expense_date >= $1::date and e.expense_date < $2::date and ($3::int is null or e.store_id = $3) group by c.name order by total desc`, [from, next, storeId]);
    const expTotal = r2(exp.reduce((x: number, e: any) => x + e.total, 0));

    // the bank, for the account asked for, or the accounts of the store, or all of them
    const bankWhere = `a.business_id = $1 and t.txn_date >= $2::date and t.txn_date < $3::date and ($4::int is null or t.account_id = $4) and ($5::int is null or a.store_id = $5)`;
    const bankArgs = [businessId, from, next, accountId, storeId];
    const byTag = await this.manager.query(
      `select coalesce(t.tag, 'UNTAGGED') as tag, coalesce(sum(t.credit), 0)::float as credit, coalesce(sum(t.debit), 0)::float as debit, count(*)::int as n
         from bank_txn t join bank_account a on a.id = t.account_id where ${bankWhere} group by 1`, bankArgs);
    const byCategory = await this.manager.query(
      `select coalesce(t.expense_category, 'Uncategorised') as category, coalesce(sum(t.debit), 0)::float as total from bank_txn t join bank_account a on a.id = t.account_id
        where ${bankWhere} and t.tag = 'EXPENSE' group by 1 order by total desc`, bankArgs);
    const [bk] = await this.manager.query(`select coalesce(sum(t.credit), 0)::float as credit, coalesce(sum(t.debit), 0)::float as debit, count(*)::int as n, count(*) filter (where t.status = 'UNEXPLAINED')::int as unexplained from bank_txn t join bank_account a on a.id = t.account_id where ${bankWhere}`, bankArgs);
    const bankIncome = r2(byTag.filter((t: any) => isIncomeTag(t.tag)).reduce((x: number, t: any) => x + t.credit, 0));
    const bankExpense = r2(byTag.filter((t: any) => isExpenseTag(t.tag)).reduce((x: number, t: any) => x + t.debit, 0));

    // by month, for the trend
    const trend = await this.manager.query(
      `with m as (select generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), '1 month')::date as d)
       select to_char(m.d, 'YYYY-MM') as month,
              (select coalesce(sum(total), 0)::float from sale where status = 'COMPLETE' and date_trunc('month', bill_date) = m.d and ($3::int is null or store_id = $3)) as sales,
              (select coalesce(sum(total), 0)::float from purchase_invoice where status = 'COMPLETE' and active and not archive and date_trunc('month', invoice_date) = m.d and ($3::int is null or store_id = $3)) as purchases,
              (select coalesce(sum(amount), 0)::float from expense where status = 'APPROVED' and date_trunc('month', expense_date) = m.d and ($3::int is null or store_id = $3)) as expenses,
              (select coalesce(sum(t.credit), 0)::float from bank_txn t join bank_account a on a.id = t.account_id where a.business_id = $4 and date_trunc('month', t.txn_date) = m.d and ($5::int is null or t.account_id = $5) and ($3::int is null or a.store_id = $3)) as bank_in,
              (select coalesce(sum(t.debit), 0)::float from bank_txn t join bank_account a on a.id = t.account_id where a.business_id = $4 and date_trunc('month', t.txn_date) = m.d and ($5::int is null or t.account_id = $5) and ($3::int is null or a.store_id = $3)) as bank_out
         from m order by m.d`, [from, to, storeId, businessId, accountId]);

    return {
      from, to, stores, store: storeId, tolerance: await this.tolerance(),
      books: {
        sales: { ...s, bills: s.bills }, purchases: pu, vendorPayments: r2(vp.total), expenses: exp, expensesTotal: expTotal,
        // sales less what was bought and spent: a cash view, not profit (the change in stock is not in it)
        net: r2(s.total - pu.total - expTotal),
      },
      bank: { credits: r2(bk.credit), debits: r2(bk.debit), lines: bk.n, unexplained: bk.unexplained, income: bankIncome, expense: bankExpense, byTag: byTag.map((t: any) => ({ ...t, label: t.tag === 'UNTAGGED' ? 'Not yet tagged' : TAG_LABEL[t.tag] })), byCategory },
      trend,
    };
  }

  // ------------------------------------------------------------------ records and retention
  async records(user: any) {
    const { businessId, stores } = await this.business(user);
    const [set] = await this.manager.query(`select setting_value from app_setting where setting_key = 'records_retention_years' and active and not archive limit 1`);
    const years = Math.min(Math.max(Number(set?.setting_value) || 8, 1), 30);
    const today = istDay();
    const fyStart = (d: string) => (+d.slice(5, 7) >= 4 ? +d.slice(0, 4) : +d.slice(0, 4) - 1);
    const thisFy = fyStart(today);
    const firstFy = thisFy - years;
    const from = `${firstFy}-04-01`;
    const sales = await this.manager.query(`select to_char(bill_date, 'YYYY-MM') as m, count(*)::int as n from sale where status = 'COMPLETE' and bill_date >= $1::date group by 1`, [from]);
    const purchases = await this.manager.query(`select to_char(invoice_date, 'YYYY-MM') as m, count(*)::int as n from purchase_invoice where status = 'COMPLETE' and active and not archive and invoice_date >= $1::date group by 1`, [from]);
    const bank = await this.manager.query(
      `select a.id as account_id, a.name, to_char(t.txn_date, 'YYYY-MM') as m, count(*)::int as n from bank_txn t join bank_account a on a.id = t.account_id where a.business_id = $1 and t.txn_date >= $2::date group by 1, 2, 3`, [businessId, from]);
    const accounts = await this.manager.query(`select id, name from bank_account where business_id = $1 and active order by name`, [businessId]);
    const audits = await this.manager.query(`select extract(year from (certified_on - interval '3 months'))::int as fy, count(*)::int as n from stock_audit where business_id = $1 and certified_on is not null group by 1`, [businessId]);
    const set2 = (rows: any[]) => new Map<string, number>(rows.map((r) => [r.m, r.n]));
    const sMap = set2(sales), pMap = set2(purchases);
    const monthsOf = (fy: number) => Array.from({ length: 12 }, (_, i) => { const mm = ((i + 3) % 12) + 1; const yy = mm >= 4 ? fy : fy + 1; return `${yy}-${String(mm).padStart(2, '0')}`; }).filter((m) => m <= today.slice(0, 7));
    const earliest = await this.manager.query(`select (select to_char(min(bill_date), 'YYYY-MM') from sale where status = 'COMPLETE') as sale, (select to_char(min(invoice_date), 'YYYY-MM') from purchase_invoice where status = 'COMPLETE' and active and not archive) as purchase`);
    const rows: any[] = [];
    for (let fy = thisFy; fy >= firstFy; fy--) {
      const ms = monthsOf(fy);
      const have = (mp: Map<string, number>) => ms.filter((m) => mp.has(m)).length;
      rows.push({
        fy: `${fy}-${String(fy + 1).slice(2)}`, months: ms.length, before: ms.every((m) => m < (earliest[0].sale ?? '9999') && m < (earliest[0].purchase ?? '9999')),
        sales: { bills: ms.reduce((x, m) => x + (sMap.get(m) ?? 0), 0), months: have(sMap), missing: ms.filter((m) => !sMap.has(m) && m >= (earliest[0].sale ?? '9999')) },
        purchases: { invoices: ms.reduce((x, m) => x + (pMap.get(m) ?? 0), 0), months: have(pMap), missing: ms.filter((m) => !pMap.has(m) && m >= (earliest[0].purchase ?? '9999')) },
        bank: accounts.map((a: any) => ({ account: a.name, months: bank.filter((b: any) => b.account_id === a.id && ms.includes(b.m)).length })),
        audits: audits.find((a: any) => a.fy === fy)?.n ?? 0,
      });
    }
    // the paper H1 register: checked each month, signed here
    const attested = await this.manager.query(
      `select to_char(r.period, 'YYYY-MM') as m, r.store_id, to_char(r.checked_on, 'YYYY-MM-DD') as day, u.full_name as by_name, r.note from records_attestation r join app_user u on u.id = r.checked_by where r.business_id = $1 and r.kind = 'H1_REGISTER'`, [businessId]);
    const recent = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - i, 1)); return d.toISOString().slice(0, 7); });
    const h1 = recent.map((m) => ({ month: m, checked: attested.filter((a: any) => a.m === m).map((a: any) => ({ store_id: a.store_id, day: a.day, by: a.by_name, note: a.note })) }));
    // the paper H1 register is a pharmacy matter: other kinds of business are not shown it
    const pharmacy = await this.modules.packOnForBusiness(businessId, 'pharmacy');
    return { retentionYears: years, keepFrom: `${thisFy - years + 1}-04-01`, earliest: earliest[0], years: rows, h1: pharmacy ? h1 : [], pharmacy, stores, accounts };
  }

  async attest(user: any, body: any) {
    const { businessId, stores } = await this.business(user);
    if (!isMonth(body?.period)) throw new BadRequestException('Give the month as year-month, for example 2026-09.');
    const period = monthBounds(body.period).start;
    if (period > istDay()) throw new BadRequestException('That month has not started.');
    const storeId = Number(body?.store_id) || null;
    if (storeId && !stores.some((s) => s.id === storeId)) throw new BadRequestException('That store is not in your business.');
    const r = await this.manager.query(
      `insert into records_attestation (business_id, store_id, kind, period, checked_by, note) values ($1,$2,'H1_REGISTER',$3::date,$4,$5) on conflict do nothing returning id`,
      [businessId, storeId, period, user.id, text(body?.note, 200)]);
    if (!r.length) throw new BadRequestException('That month is already marked as checked.');
    await this.audit.record({ userId: user.id, action: 'records.h1_checked', entityType: 'records', entityId: r[0].id, summary: `Paper H1 register checked for ${period.slice(0, 7)}`, details: { store_id: storeId } });
    return { id: r[0].id };
  }
}
