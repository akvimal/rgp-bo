import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { bookSql } from '../stock/disposal.service';
import { lineValues } from '../stock/disposal-rules';
import { StockAuditService } from './stock-audit.service';

const text = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

export interface ExpiryRow {
  itemid: number; title: string; batch: string | null; expdate: string; schedule: string | null; counted: number | null; balance: number; held: number; sellable: number;
  adjusted: number; kind: 'ON_BOOKS' | 'UNRECORDED' | 'BOTH'; value: number; passid: number | null; passno: string | null; passstatus: string | null; note: string | null; resolved: boolean;
}

/**
 * Expiry inside a stock audit. Of the batches the count covered, those expired or within 30 days of expiry are looked at in two ways:
 *   - still on the books (the stock is there, or the books say it is): it needs an out-pass, or a short explanation;
 *   - written off by the count itself (a shortage approved on the audit) with no out-pass behind it: an "unrecorded disposal", which also needs one or the other.
 * An audit is not signed off while any of them is open. The certificate carries what was found and how it stands.
 */
@Injectable()
export class AuditExpiryService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly audits: StockAuditService) {}

  /** the expiry picture of an audit's count; empty when the audit has no count yet */
  async compute(a: any): Promise<{ rows: ExpiryRow[]; open: number; onBooks: number; unrecorded: number; unrecordedValue: number; explained: number; passes: any[] }> {
    const empty = { rows: [], open: 0, onBooks: 0, unrecorded: 0, unrecordedValue: 0, explained: 0, passes: [] as any[] };
    if (!a?.count_id) return empty;
    const raw = await this.manager.query(
      `select l.item_id, l.title, l.batch, to_char(l.exp_date, 'YYYY-MM-DD') as exp_date, l.counted_qty, nullif(p.more_props->>'schedule', '') as schedule,
              ${bookSql('$2')}::int as balance,
              coalesce((select sum(dpl.qty) from disposal_pass_line dpl inner join disposal_pass dp on dp.id = dpl.pass_id where dpl.item_id = l.item_id and dp.status = 'APPROVED' and dp.store_id = $2), 0)::int as held,
              coalesce((select sum(q.qty) from product_qtychange q where q.count_id = $1 and q.item_id = l.item_id and coalesce(q.status, 'PENDING') = 'APPROVED'), 0)::int as adjusted,
              coalesce(p.pack, 1) as pack, pii.ptr_value::float as ptr_value, coalesce(pii.tax_pcnt, 0)::float as tax_pcnt,
              (select dp.id from disposal_pass_line dpl inner join disposal_pass dp on dp.id = dpl.pass_id
                where dpl.item_id = l.item_id and dp.store_id = $2 and dp.status in ('DRAFT', 'APPROVED', 'CONFIRMED') and (dp.audit_id = $3 or dp.prepared_on >= coalesce($4::timestamptz, 'epoch'))
                order by dp.id desc limit 1) as pass_id,
              (select n.note from stock_audit_expiry_note n where n.audit_id = $3 and n.item_id = l.item_id) as note
         from stock_count_line l inner join purchase_invoice_item pii on pii.id = l.item_id inner join purchase_invoice i on i.id = pii.invoice_id inner join product p on p.id = pii.product_id
        where l.count_id = $1 and l.exp_date is not null and public.expiry_end(l.exp_date) < current_date + 30
        order by upper(l.title), l.batch`, [a.count_id, a.store_id, a.id, a.started_on ?? null]);
    const passIds = Array.from(new Set(raw.map((r: any) => r.pass_id).filter(Boolean))) as number[];
    const passes = passIds.length ? await this.manager.query(
      `select dp.id, dp.pass_no, dp.status, (select coalesce(sum(l.qty), 0) from disposal_pass_line l where l.pass_id = dp.id)::int as qty from disposal_pass dp where dp.id = any($1::int[]) order by dp.id`, [passIds]) : [];
    const passBy = new Map<number, any>(passes.map((p: any) => [+p.id, p]));
    const rows: ExpiryRow[] = [];
    let unrecordedValue = 0;
    for (const r of raw) {
      const onBooks = r.balance > 0;
      const written = r.adjusted < 0;
      if (!onBooks && !written) continue;
      const pass = r.pass_id ? passBy.get(+r.pass_id) : null;
      const kind = onBooks && written ? 'BOTH' : onBooks ? 'ON_BOOKS' : 'UNRECORDED';
      const value = lineValues(onBooks ? r.balance : -r.adjusted, r.pack, r.ptr_value, r.tax_pcnt, 0).cost;
      if (written && !pass) unrecordedValue += lineValues(-r.adjusted, r.pack, r.ptr_value, r.tax_pcnt, 0).cost;
      rows.push({
        itemid: +r.item_id, title: r.title, batch: r.batch, expdate: r.exp_date, schedule: r.schedule, counted: r.counted_qty, balance: r.balance, held: r.held, sellable: Math.max(0, r.balance - r.held),
        adjusted: r.adjusted, kind, value, passid: pass ? +pass.id : null, passno: pass?.pass_no ?? null, passstatus: pass?.status ?? null, note: r.note, resolved: !!pass || !!r.note,
      });
    }
    const written = rows.filter((x) => x.kind !== 'ON_BOOKS');
    return {
      rows, open: rows.filter((x) => !x.resolved).length, onBooks: rows.filter((x) => x.kind !== 'UNRECORDED').length,
      unrecorded: written.filter((x) => !x.passid).length, unrecordedValue: Math.round(unrecordedValue * 100) / 100, explained: rows.filter((x) => !x.passid && x.note).length, passes,
    };
  }

  /** how many expired or near-expiry batches of the audit still need an out-pass or an explanation */
  async openCount(a: any): Promise<number> { return (await this.compute(a)).open; }

  async review(id: number, user: any) {
    const { a } = await this.audits.access(id, user);
    const r = await this.compute(a);
    return { auditid: id, storeid: a.store_id, status: a.status, certified: !!a.certified_on, counted: !!a.count_id, ...r };
  }

  /** a short explanation for an expired batch that has no out-pass (who threw it away, when, how); empty text takes it back */
  async explain(id: number, body: any, user: any) {
    const { a } = await this.audits.access(id, user);
    if (!a.count_id) throw new BadRequestException('Start the count first.');
    if (a.certified_on) throw new BadRequestException('This audit is already certified.');
    const itemid = Number(body?.itemid);
    if (!(itemid > 0)) throw new BadRequestException('Choose the batch.');
    const known = (await this.compute(a)).rows.some((r) => r.itemid === itemid);
    if (!known) throw new BadRequestException('That batch is not an expired batch of this audit.');
    const note = text(body?.note, 300);
    if (!note) {
      await this.manager.query(`delete from stock_audit_expiry_note where audit_id = $1 and item_id = $2`, [id, itemid]);
    } else {
      if (note.length < 5) throw new BadRequestException('Say a little more: who, when and how.');
      await this.manager.query(
        `insert into stock_audit_expiry_note (audit_id, item_id, note, created_by) values ($1, $2, $3, $4)
         on conflict (audit_id, item_id) do update set note = excluded.note, created_by = excluded.created_by, created_on = now()`, [id, itemid, note, user.id]);
    }
    await this.audit.record({ userId: user.id, action: 'stock_audit.expiry_note', entityType: 'stock_audit', entityId: id, summary: `Expiry explanation ${note ? 'saved' : 'removed'} for a batch of audit ${id}`, details: { itemid } });
    return this.review(id, user);
  }
}
