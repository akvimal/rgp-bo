import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { fyBounds, parsePrefix } from './gst-tax';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const isDay = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

/** Whether the business is on GST and from when (GST_SIMPLE_PLAN phase 2). Two kinds: not registered, and registered and filing. */
@Injectable()
export class GstRegistrationService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async business(user: any): Promise<number> {
    const id = await businessOfUser(this.manager, user.id);
    if (!id) throw new ForbiddenException('Your account is not placed in a business.');
    return id;
  }

  private async load(businessId: number) {
    await this.manager.query(`insert into gst_registration (business_id) values ($1) on conflict (business_id) do nothing`, [businessId]);
    const [r] = await this.manager.query(
      `select r.reg_type, to_char(r.go_live, 'YYYY-MM-DD') as go_live, r.invoice_prefix, r.turnover_limit::float8 as turnover_limit, r.hsn_digits,
              b.name, b.legal_name, b.gstin, b.state_code
         from gst_registration r join business b on b.id = r.business_id where r.business_id = $1`, [businessId]);
    return r;
  }

  async get(user: any) {
    const businessId = await this.business(user);
    const r = await this.load(businessId);
    const today = istDay();
    const fy = fyBounds(today);
    const [t] = await this.manager.query(
      `select coalesce(sum(s.total), 0)::float8 as turnover from sale s join stores st on st.id = s.store_id
        where st.business_id = $1 and s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= $2::date and s.bill_date < ($3::date + 1)`, [businessId, fy.from, fy.to]);
    const [issued] = await this.manager.query(`select count(*)::int as n, max(gst_invoice_no) as last from sale where gst_business_id = $1 and gst_invoice_no is not null`, [businessId]);
    const turnover = Math.round(Number(t.turnover) * 100) / 100;
    const pct = r.turnover_limit > 0 ? Math.round((turnover / r.turnover_limit) * 1000) / 10 : 0;
    return {
      reg_type: r.reg_type, go_live: r.go_live, invoice_prefix: r.invoice_prefix, hsn_digits: r.hsn_digits, gstin: r.gstin, state_code: r.state_code, legal_name: r.legal_name, business: r.name,
      turnover_limit: r.turnover_limit, turnover_fy: turnover, fy_from: fy.from, fy_to: fy.to, turnover_pct: pct,
      watch: r.reg_type === 'none' ? (pct >= 100 ? 'over' : pct >= 80 ? 'near' : 'ok') : null,
      invoices_issued: issued.n, last_invoice: issued.last, today,
      live: r.reg_type === 'registered' && !!r.go_live && r.go_live <= today,
    };
  }

  async save(user: any, body: any) {
    const businessId = await this.business(user);
    const cur = await this.get(user);
    const type = String(body?.reg_type ?? cur.reg_type);
    if (type !== 'none' && type !== 'registered') throw new BadRequestException('Choose not registered, or registered and filing.');
    const prefix: { value?: string; error?: string } = body?.invoice_prefix !== undefined ? parsePrefix(body.invoice_prefix) : { value: cur.invoice_prefix };
    if (prefix.error) throw new BadRequestException(prefix.error);
    let limit = cur.turnover_limit;
    if (body?.turnover_limit !== undefined) {
      limit = Number(body.turnover_limit);
      if (!Number.isFinite(limit) || limit <= 0 || limit > 1e10) throw new BadRequestException('The registration limit must be an amount above zero.');
    }
    let digits = cur.hsn_digits;
    if (body?.hsn_digits !== undefined) {
      digits = Number(body.hsn_digits);
      if (![4, 6, 8].includes(digits)) throw new BadRequestException('The HSN digits are 4, 6 or 8.');
    }
    let gstin = cur.gstin;
    let goLive: string | null = cur.go_live;
    if (type === 'registered') {
      if (body?.gstin !== undefined) gstin = String(body.gstin || '').trim().toUpperCase() || null;
      if (!gstin) throw new BadRequestException('Enter the GSTIN to register.');
      const [ok] = await this.manager.query(`select public.is_valid_gstin($1) as ok`, [gstin]);
      if (!ok?.ok) throw new BadRequestException('That is not a valid GSTIN. Check the 15 characters, the state code and the check digit.');
      if (body?.go_live !== undefined) goLive = String(body.go_live || '') || null;
      if (!goLive || !isDay(goLive)) throw new BadRequestException('Give the date from which you issue tax invoices (the go-live date).');
      if (cur.reg_type === 'registered' && cur.invoices_issued > 0) {
        if (gstin !== cur.gstin) throw new BadRequestException('Tax invoices were issued under this GSTIN. A different GSTIN is a new registration.');
        if (goLive !== cur.go_live) throw new BadRequestException('Tax invoices were issued from the go-live date, so it cannot be moved.');
      } else if (cur.invoices_issued > 0) {
        // registering again after a gap: the new series starts after the last invoice already issued
        const [last] = await this.manager.query(`select to_char(max(bill_date), 'YYYY-MM-DD') as d from sale where gst_business_id = $1 and gst_invoice_no is not null`, [businessId]);
        if (last?.d && goLive < last.d) throw new BadRequestException(`Tax invoices were issued up to ${last.d}. The new go-live date cannot be before that.`);
      }
    } else {
      if (cur.reg_type === 'registered' && body?.confirm_cancelled !== true) {
        throw new BadRequestException('Going back to not registered stops tax invoices from now. Earlier invoices stay as they are. Confirm it to continue.');
      }
      goLive = null;
    }
    await this.manager.transaction(async (tm) => {
      await tm.query(
        `update gst_registration set reg_type = $2, go_live = $3, invoice_prefix = $4, turnover_limit = $5, hsn_digits = $7, updated_by = $6, updated_on = now() where business_id = $1`,
        [businessId, type, goLive, prefix.value, limit, user.id, digits]);
      if (type === 'registered') await tm.query(`update business set gstin = $2, state_code = $3 where id = $1`, [businessId, gstin, gstin!.slice(0, 2)]);
    });
    await this.audit.record({
      userId: user.id, action: 'gst.registration_saved', entityType: 'gst_registration', entityId: businessId,
      summary: type === 'registered' ? `registered and filing, GSTIN ${gstin}, tax invoices from ${goLive}` : `not registered${cur.reg_type === 'registered' ? ' (was registered)' : ''}`,
      details: { before: { reg_type: cur.reg_type, go_live: cur.go_live, gstin: cur.gstin }, after: { reg_type: type, go_live: goLive, gstin } },
    });
    return this.get(user);
  }
}
