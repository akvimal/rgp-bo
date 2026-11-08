import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { NIL_MOBILE } from './customer-rules';
import { SNOOZE_REASONS, checkSnooze } from './customer-snooze';
import { InviteFacts, reasonText, reviewInviteDecision, reviewMessage } from './customer-review-rules';
import { AUDIENCES, AudienceDef, CustomerFacts, Profile, SEGMENTS, classify, contactable } from './customer-relationship-rules';

export const CONTACT_CHANNELS = ['CALL', 'WHATSAPP', 'SMS', 'VISIT', 'OTHER'];
export const CONTACT_OUTCOMES = ['SENT', 'REACHED', 'NO_ANSWER', 'CALLBACK', 'NOT_INTERESTED', 'WRONG_NUMBER', 'ASKED_TO_STOP'];
const DEFAULT_ACTIVE_DAYS = 365;
const DEFAULT_CAP_DAYS = 7;
const WORKLIST_SIZE = 40;

interface Row extends CustomerFacts {
  name: string | null; mobile: string | null; locality: string | null;
  consent: string | null; doNotContact: boolean; preferredChannel: string | null;
  lastContact?: string | null; daysSinceContact: number | null;
}

/**
 * The relationship side of customers: who is active, which segment and tier each customer is in, the audiences a campaign can draw on,
 * the daily list of people to contact, and the log of what was said. Everything is read from the bills at the time of asking.
 */
@Injectable()
export class CustomerRelationshipService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  // ------------------------------------------------------------------------------------------------ settings
  private async number(key: string, fallback: number, min: number, max: number): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive limit 1`, [key]);
    const n = Math.round(Number(r?.setting_value));
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  }

  async settings() {
    return {
      activeDays: await this.number('customer_active_days', DEFAULT_ACTIVE_DAYS, 30, 1825),
      contactCapDays: await this.number('customer_contact_cap_days', DEFAULT_CAP_DAYS, 0, 90),
    };
  }

  async saveSettings(body: { activeDays?: any; contactCapDays?: any }, user: any) {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!isOwnerRole(role?.name)) throw new ForbiddenException('Only the Business Head changes these settings.');
    const put = async (key: string, raw: any, min: number, max: number, label: string, description: string) => {
      if (raw === undefined) return;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${label} must be a whole number from ${min} to ${max}.`);
      const upd = await this.manager.query(
        `update app_setting set setting_value = $1, updated_on = now(), updated_by = $2 where setting_key = $3 returning id`, [String(n), user.id, key]);
      if (!upd.length) {
        await this.manager.query(
          `insert into app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by) values ('customers', $1, $2, $3, true, false, $4, $4)`,
          [key, String(n), description, user.id]);
      }
    };
    await put('customer_active_days', body?.activeDays, 30, 1825, 'The active period (days)', 'A customer with no visit in this many days is shown as inactive');
    await put('customer_contact_cap_days', body?.contactCapDays, 0, 90, 'The contact gap (days)', 'Do not contact the same customer again within this many days');
    return this.settings();
  }

  // ------------------------------------------------------------------------------------------------ the facts
  private async rows(): Promise<Row[]> {
    const rows = await this.manager.query(`
      with v as (
        select s.customer_id, s.bill_date::date as d, sum(s.total) as val
          from sale s
         where s.status = 'COMPLETE' and s.active and not s.archive and s.customer_id is not null
         group by s.customer_id, s.bill_date::date),
      agg as (
        select customer_id, count(*)::int as visits_all, min(d) as first_d, max(d) as last_d,
               count(*) filter (where d >= current_date - 365)::int as visits12,
               coalesce(sum(val) filter (where d >= current_date - 365), 0)::float as spend12
          from v group by customer_id),
      gaps as (
        select customer_id, d - lag(d) over (partition by customer_id order by d) as gap from v where d >= current_date - 730),
      rhythm as (
        select customer_id, percentile_cont(0.5) within group (order by gap) filter (where gap >= 7) as med from gaps group by customer_id),
      cr as (select customer_id, sum(amount)::float as bal from customer_credit_entry group by customer_id),
      lc as (select customer_id, max(created_on) as last_contact from customer_contact_log group by customer_id)
      select c.id, c.name, c.mobile, c.locality, c.contact_consent as consent, c.do_not_contact, c.preferred_channel,
             coalesce(a.visits_all, 0) as visits_all, coalesce(a.visits12, 0) as visits12, coalesce(a.spend12, 0) as spend12,
             (current_date - a.last_d) as days_last, (current_date - a.first_d) as days_first,
             (current_date - c.created_on::date) as days_created, round(rhythm.med)::int as usual_gap, coalesce(cr.bal, 0) as credit,
             lc.last_contact, extract(day from now() - lc.last_contact)::int as days_contact
        from customer c
        left join agg a on a.customer_id = c.id
        left join rhythm on rhythm.customer_id = c.id
        left join cr on cr.customer_id = c.id
        left join lc on lc.customer_id = c.id
       where c.active and not c.archive and c.mobile is distinct from $1`, [NIL_MOBILE]);
    return rows.map((r: any) => ({
      id: r.id, name: r.name, mobile: r.mobile, locality: r.locality, consent: r.consent, doNotContact: !!r.do_not_contact,
      preferredChannel: r.preferred_channel, visitsAll: r.visits_all, visits12: r.visits12, spend12: Number(r.spend12) || 0,
      daysSinceLast: r.days_last === null ? null : Number(r.days_last), daysSinceFirst: r.days_first === null ? null : Number(r.days_first),
      daysSinceCreated: Number(r.days_created) || 0, usualGap: r.usual_gap === null ? null : Number(r.usual_gap), credit: Number(r.credit) || 0,
      lastContact: r.last_contact, daysSinceContact: r.days_contact === null ? null : Number(r.days_contact),
    }));
  }

  /** every real customer's profile by id (the NIL walk-in has none) */
  async profiles(): Promise<Map<number, Profile & { spend12: number; visits12: number }>> {
    const { activeDays } = await this.settings();
    const rows = await this.rows();
    const out = classify(rows, activeDays);
    const byId = new Map<number, any>();
    for (const r of rows) byId.set(r.id, { ...out.get(r.id), spend12: r.spend12, visits12: r.visits12 });
    return byId;
  }

  async profileOf(id: number) {
    const { activeDays } = await this.settings();
    const rows = await this.rows();
    const profile = classify(rows, activeDays).get(id);
    const row = rows.find((r) => r.id === id);
    if (!profile || !row) return null;
    return { ...profile, visits12: row.visits12, spend12: row.spend12, visitsAll: row.visitsAll, daysSinceLast: row.daysSinceLast, credit: row.credit };
  }

  // ------------------------------------------------------------------------------------------------ the overview
  async summary() {
    const { activeDays, contactCapDays } = await this.settings();
    const rows = await this.rows();
    const profiles = classify(rows, activeDays);
    const total12 = rows.reduce((t, r) => t + r.spend12, 0);
    const segments = SEGMENTS.map((segment) => {
      const members = rows.filter((r) => profiles.get(r.id)!.segment === segment);
      const spend = members.reduce((t, r) => t + r.spend12, 0);
      return { segment, customers: members.length, spend12: Math.round(spend), share: total12 > 0 ? Math.round((1000 * spend) / total12) / 10 : 0 };
    });
    const status = { active: 0, inactive: 0 };
    rows.forEach((r) => status[profiles.get(r.id)!.status]++);
    const tiers = { Gold: 0, Silver: 0, Bronze: 0 };
    rows.forEach((r) => { const t = profiles.get(r.id)!.tier; if (t) tiers[t]++; });
    return { activeDays, contactCapDays, status, tiers, segments, total: rows.length };
  }

  // ------------------------------------------------------------------------------------------------ audiences
  /** The audiences with how many customers are in each and how many of those can be contacted. */
  async audiences() {
    const { activeDays, contactCapDays } = await this.settings();
    const rows = await this.rows();
    const profiles = classify(rows, activeDays);
    return {
      contactCapDays,
      audiences: AUDIENCES.map((a) => this.describe(a, rows, profiles, contactCapDays)),
    };
  }

  private describe(a: AudienceDef, rows: Row[], profiles: Map<number, Profile>, cap: number) {
    const inAudience = rows.filter((r) => a.match(profiles.get(r.id)!, r));
    let reachable = 0, recent = 0;
    for (const r of inAudience) {
      if (!contactable(r, a.promo).ok) continue;
      if (this.recentlyContacted(r, cap)) recent++; else reachable++;
    }
    return { key: a.key, label: a.label, help: a.help, promo: a.promo, customers: inAudience.length, reachable, recentlyContacted: recent };
  }

  private recentlyContacted(r: Row, cap: number): boolean {
    return cap > 0 && r.daysSinceContact !== null && r.daysSinceContact < cap;
  }

  /**
   * The members of one audience, narrowed by what they bought (a product name, how far back, chronic or OTC) and where they live.
   * Each member says whether they can be contacted and why not, so the screen can show the gap rather than hide it.
   */
  async audience(body: { audience: string; product?: string; months?: number; kind?: string; locality?: string }) {
    const def = AUDIENCES.find((a) => a.key === body?.audience);
    if (!def) throw new BadRequestException('Unknown audience.');
    const { activeDays, contactCapDays } = await this.settings();
    const rows = await this.rows();
    const profiles = classify(rows, activeDays);
    let members = rows.filter((r) => def.match(profiles.get(r.id)!, r));

    const product = String(body?.product || '').trim();
    const kind = ['chronic', 'otc'].includes(String(body?.kind)) ? String(body.kind) : '';
    if (product || kind) {
      const months = Math.min(Math.max(Math.round(Number(body?.months)) || 6, 1), 36);
      const bought = await this.manager.query(
        `select distinct s.customer_id as id
           from sale s join sale_item si on si.sale_id = s.id join product p on p.id = si.product_id
          where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and s.customer_id is not null
            and s.bill_date >= current_date - ($1::int * interval '1 month')
            and ($2::text = '' or p.title ilike '%' || $2 || '%')
            and ($3::text <> 'chronic' or p.more_props->>'chronic' = 'true')
            and ($3::text <> 'otc' or p.category = 'OTC')`, [months, product, kind]);
      const ids = new Set<number>(bought.map((b: any) => +b.id));
      members = members.filter((m) => ids.has(m.id));
    }
    const locality = String(body?.locality || '').trim().toLowerCase();
    if (locality) members = members.filter((m) => String(m.locality || '').toLowerCase().includes(locality));

    members.sort((a, b) => b.spend12 - a.spend12);
    const out = members.slice(0, 2000).map((m) => {
      const p = profiles.get(m.id)!;
      const c = contactable(m, def.promo);
      const recent = c.ok && this.recentlyContacted(m, contactCapDays);
      return {
        id: m.id, name: m.name, mobile: m.mobile, locality: m.locality, segment: p.segment, tier: p.tier, reason: p.reason,
        visits12: m.visits12, spend12: Math.round(m.spend12), daysSinceLast: m.daysSinceLast, consent: m.consent, preferredChannel: m.preferredChannel,
        canContact: c.ok && !recent, why: recent ? (m.daysSinceContact === 0 ? 'Contacted today' : `Contacted ${m.daysSinceContact} day${m.daysSinceContact === 1 ? '' : 's'} ago`) : c.why,
      };
    });
    return {
      audience: { key: def.key, label: def.label, help: def.help, promo: def.promo },
      contactCapDays, total: members.length, canContact: out.filter((m) => m.canContact).length, members: out,
    };
  }

  // ------------------------------------------------------------------------------------------------ the daily worklist
  /** Who to contact today: due-back regulars first, then people slipping away, then new customers who have not come back; best spenders first. */
  async worklist() {
    const { activeDays, contactCapDays } = await this.settings();
    const rows = await this.rows();
    const profiles = classify(rows, activeDays);
    const order = ['due_back', 'at_risk', 'new_second_visit'];
    const picked: any[] = [];
    const seen = new Set<number>();
    for (const key of order) {
      const def = AUDIENCES.find((a) => a.key === key)!;
      const hits = rows
        .filter((r) => !seen.has(r.id) && def.match(profiles.get(r.id)!, r))
        .filter((r) => contactable(r, false).ok && !this.recentlyContacted(r, contactCapDays))
        .sort((a, b) => b.spend12 - a.spend12);
      for (const r of hits) {
        seen.add(r.id);
        const p = profiles.get(r.id)!;
        picked.push({ id: r.id, name: r.name, mobile: r.mobile, locality: r.locality, audience: key, audienceLabel: def.label, segment: p.segment, tier: p.tier,
          reason: p.reason, spend12: Math.round(r.spend12), preferredChannel: r.preferredChannel, consent: r.consent });
      }
    }
    // customers who owe money on credit come first: they are few, and the reminder is about money
    const owing = await this.manager.query(
      `select e.customer_id as id, sum(e.amount)::float8 as bal, min(e.entry_date) filter (where e.amount > 0) as since, current_date - min(e.entry_date) filter (where e.amount > 0) as days
         from customer_due_entry e group by e.customer_id having sum(e.amount) >= 1 order by sum(e.amount) desc`);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const dues: any[] = [];
    for (const o of owing) {
      const r = byId.get(o.id);
      if (!r || !contactable(r, false).ok || this.recentlyContacted(r, contactCapDays)) continue;
      const p = profiles.get(r.id)!;
      const days = o.days === null || o.days === undefined ? null : Number(o.days);
      dues.push({ id: r.id, name: r.name, mobile: r.mobile, locality: r.locality, audience: 'dues', audienceLabel: 'Unpaid dues', segment: p.segment, tier: p.tier,
        reason: `Owes Rs ${Math.round(o.bal).toLocaleString('en-IN')}${days !== null ? `, the oldest entry ${days} day${days === 1 ? '' : 's'} ago` : ''}`, amount: Math.round(o.bal), spend12: Math.round(r.spend12),
        preferredChannel: r.preferredChannel, consent: r.consent });
      if (dues.length >= 15) break;
    }
    // a customer who owes money is listed once, as owing, even if they also fit another audience
    const owingIds = new Set(dues.map((d) => d.id));
    const rest = picked.filter((p) => !owingIds.has(p.id));
    picked.length = 0;
    picked.push(...dues, ...rest);
    // a customer postponed to a later day is left off until then and listed apart, with the reason
    const postponed = await this.activeSnoozes();
    const shown = picked.filter((p) => !postponed.has(p.id));
    const apart = picked.filter((p) => postponed.has(p.id)).map((p) => {
      const z = postponed.get(p.id)!;
      return { id: p.id, name: p.name, audienceLabel: p.audienceLabel, reason: SNOOZE_REASONS[z.reason] || z.reason, note: z.note, until: z.until, by: z.by_name, times: z.times };
    });
    return { contactCapDays, waiting: shown.length, rows: shown.slice(0, WORKLIST_SIZE), snoozed: apart };
  }

  // ------------------------------------------------------------------------------------------------ postponing a customer for a day
  /** the postponements still running (until a later day than today, India time), newest per customer, with how often they were postponed lately */
  private async activeSnoozes(): Promise<Map<number, any>> {
    const rows = await this.manager.query(
      `select distinct on (z.customer_id) z.customer_id, z.reason, z.note, z.snoozed_until::text as until, u.full_name as by_name,
              (select count(*)::int from worklist_snooze z2 where z2.customer_id = z.customer_id and z2.created_on >= now() - interval '30 days') as times
         from worklist_snooze z left join app_user u on u.id = z.created_by
        where z.snoozed_until > (now() at time zone 'Asia/Kolkata')::date
        order by z.customer_id, z.created_on desc`);
    return new Map<number, any>(rows.map((r: any) => [r.customer_id, r]));
  }

  /** Takes a customer off today's list until tomorrow, with the reason. It is not a contact: nothing else about the customer changes. */
  async snooze(customerId: number, body: { reason?: string; note?: string }, user: any) {
    const c = checkSnooze(body);
    if (!c.ok) throw new BadRequestException(c.message);
    const [cust] = await this.manager.query(`select id from customer where id = $1 and active and not archive`, [customerId]);
    if (!cust) throw new NotFoundException('Customer not found.');
    const [row] = await this.manager.query(
      `insert into worklist_snooze (customer_id, snoozed_until, reason, note, created_by)
       values ($1, (now() at time zone 'Asia/Kolkata')::date + 1, $2, $3, $4) returning snoozed_until::text as until`,
      [customerId, c.value.reason, c.value.note, user.id]);
    return { until: row.until, reason: SNOOZE_REASONS[c.value.reason] };
  }

  /** Brings a postponed customer back on today's list. */
  async unsnooze(customerId: number) {
    await this.manager.query(
      `update worklist_snooze set snoozed_until = (now() at time zone 'Asia/Kolkata')::date
        where customer_id = $1 and snoozed_until > (now() at time zone 'Asia/Kolkata')::date`, [customerId]);
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------------------ the contact log
  async contacts(customerId: number) {
    return this.manager.query(
      `select l.id, l.channel, l.audience, l.outcome, l.note, l.created_on, u.full_name as by_name
         from customer_contact_log l left join app_user u on u.id = l.created_by
        where l.customer_id = $1 order by l.created_on desc, l.id desc limit 50`, [customerId]);
  }

  async recordContact(customerId: number, body: { channel?: string; outcome?: string; audience?: string; note?: string }, user: any) {
    const channel = String(body?.channel || '');
    const outcome = String(body?.outcome || '');
    if (!CONTACT_CHANNELS.includes(channel)) throw new BadRequestException('Choose how the customer was contacted.');
    if (!CONTACT_OUTCOMES.includes(outcome)) throw new BadRequestException('Choose what came of it.');
    const note = String(body?.note || '').trim().slice(0, 300) || null;
    const audience = String(body?.audience || '').trim().slice(0, 40) || null;
    return this.manager.transaction(async (tx) => {
      const [c] = await tx.query(`select id, name from customer where id = $1 for update`, [customerId]);
      if (!c) throw new NotFoundException('Customer not found.');
      const [row] = await tx.query(
        `insert into customer_contact_log (customer_id, channel, audience, outcome, note, created_by) values ($1, $2, $3, $4, $5, $6) returning id, created_on`,
        [customerId, channel, audience, outcome, note, user.id]);
      // asking to be left alone is honoured at once, for every audience
      if (outcome === 'ASKED_TO_STOP') await tx.query(`update customer set do_not_contact = true, updated_on = now(), updated_by = $2 where id = $1`, [customerId, user.id]);
      return row;
    });
  }

  /** consent and the stop switch, set from the customer screen */
  async setConsent(customerId: number, body: { consent?: string | null; doNotContact?: boolean; preferredChannel?: string | null; reviewOptOut?: boolean }, user: any) {
    const [c] = await this.manager.query(`select id from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    const values = this.consentValues(body, user.id);
    const cols = Object.keys(values);
    if (!cols.length) return this.consentOf(customerId);
    await this.manager.query(`update customer set ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_on = now(), updated_by = $${cols.length + 2} where id = $1`,
      [customerId, ...cols.map((k) => (values as any)[k]), user.id]);
    return this.consentOf(customerId);
  }

  /** validated column values for the consent fields that were sent (shared with the customer save) */
  consentValues(body: { consent?: any; doNotContact?: any; preferredChannel?: any; reviewOptOut?: any }, userId: number): Record<string, any> {
    const v: Record<string, any> = {};
    if (body?.consent !== undefined) {
      const c = body.consent === null || body.consent === '' ? null : String(body.consent).toUpperCase();
      if (c !== null && c !== 'YES' && c !== 'NO') throw new BadRequestException('Consent is Yes, No or not asked.');
      v.contact_consent = c;
      v.consent_on = c ? new Date() : null;
      v.consent_by = c ? userId : null;
    }
    if (body?.doNotContact !== undefined) v.do_not_contact = !!body.doNotContact;
    if (body?.reviewOptOut !== undefined) v.review_optout = !!body.reviewOptOut;
    if (body?.preferredChannel !== undefined) {
      const ch = body.preferredChannel === null || body.preferredChannel === '' ? null : String(body.preferredChannel).toUpperCase();
      if (ch !== null && !['CALL', 'WHATSAPP', 'SMS'].includes(ch)) throw new BadRequestException('Choose Call, WhatsApp or SMS.');
      v.preferred_channel = ch;
    }
    return v;
  }

  private async consentOf(customerId: number) {
    const [r] = await this.manager.query(
      `select contact_consent as consent, consent_on, do_not_contact as "doNotContact", preferred_channel as "preferredChannel", review_optout as "reviewOptOut" from customer where id = $1`, [customerId]);
    return r;
  }

  // ------------------------------------------------------------------------------------------------ Google review invitations
  /** the facts the decision needs for one bill, or null when there is no such bill */
  private async inviteFacts(saleId: number) {
    const [r] = await this.manager.query(
      `select s.id, s.bill_no as billno, s.total::float as total, s.store_id, s.customer_id, s.status,
              extract(epoch from (now() - s.created_on)) / 3600 as age_hours,
              c.name as customer_name, c.mobile, c.contact_consent as consent, c.do_not_contact, c.review_optout,
              st.location as store_name, st.google_review_url,
              exists(select 1 from grievance g where g.customer_id = c.id and g.status in ('OPEN', 'IN_PROGRESS')) as open_grievance,
              exists(select 1 from sale_return_item ri join sale_item si on si.id = ri.sale_item_id where si.sale_id = s.id and ri.active) as has_return,
              (select floor(extract(epoch from (now() - max(v.created_on))) / 86400)::int from review_invite v where v.customer_id = c.id) as last_invite_days
         from sale s left join customer c on c.id = s.customer_id join stores st on st.id = s.store_id
        where s.id = $1`, [saleId]);
    if (!r) return null;
    const minAmount = await this.number('review_invite_min_amount', 500, 0, 1000000);
    const guardDays = await this.number('review_invite_guard_days', 90, 0, 3650);
    const facts: InviteFacts = {
      total: Number(r.total) || 0, minAmount,
      hasLink: /^https:\/\//.test(String(r.google_review_url || '')),
      hasMobile: !!r.customer_id && /^[6-9][0-9]{9}$/.test(String(r.mobile || '')),
      optOut: !!r.review_optout, doNotContact: !!r.do_not_contact, consent: r.consent ?? null,
      openGrievance: !!r.open_grievance, hasReturn: !!r.has_return,
      lastInviteDaysAgo: r.last_invite_days === null || r.last_invite_days === undefined ? null : Number(r.last_invite_days),
      guardDays, billAgeHours: Number(r.age_hours) || 0,
    };
    return { row: r, facts };
  }

  /** Whether the cashier is offered the review invitation for this bill, and if so the WhatsApp link with the message ready. */
  async reviewInviteFor(saleId: number) {
    const f = await this.inviteFacts(saleId);
    if (!f || f.row.status !== 'COMPLETE') return { eligible: false, reason: 'no_customer', note: '' };
    const d = reviewInviteDecision(f.facts);
    const note = reasonText(d, f.facts.lastInviteDaysAgo);
    if (!d.eligible) return { eligible: false, reason: d.reason, note };
    const message = reviewMessage(f.row.customer_name, String(f.row.store_name || '').trim(), f.row.google_review_url);
    return {
      eligible: true, reason: '', note: '', customerId: f.row.customer_id, customerName: String(f.row.customer_name || '').trim(),
      whatsappUrl: `https://wa.me/91${f.row.mobile}?text=${encodeURIComponent(message)}`,
    };
  }

  /** The cashier sent the invitation: kept against the bill and the customer (and in their contact log), so the same customer is not asked again soon. */
  async recordReviewInvite(saleId: number, user: any) {
    const f = await this.inviteFacts(saleId);
    if (!f) throw new NotFoundException('Bill not found.');
    const d = reviewInviteDecision(f.facts);
    if (!d.eligible) throw new BadRequestException(reasonText(d, f.facts.lastInviteDaysAgo) || 'This bill is not eligible for a review invitation.');
    return this.manager.transaction(async (tx) => {
      const [row] = await tx.query(
        `insert into review_invite (store_id, sale_id, customer_id, channel, created_by) values ($1, $2, $3, 'WHATSAPP', $4)
         on conflict (sale_id) where sale_id is not null do nothing returning id`, [f.row.store_id, saleId, f.row.customer_id, user.id]);
      if (row) {
        await tx.query(
          `insert into customer_contact_log (customer_id, channel, audience, outcome, note, created_by) values ($1, 'WHATSAPP', 'review_invite', 'SENT', $2, $3)`,
          [f.row.customer_id, `Google review invitation (bill ${f.row.billno})`, user.id]);
      }
      return { ok: true, already: !row };
    });
  }

  /** whether this login may read complaints: the managers, or a role granted grievances "view" */
  private async canViewGrievances(user: any): Promise<boolean> {
    if (!user?.roleid) return false;
    const [r] = await this.manager.query(
      `select name, (permissions is not null and jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "grievances").policies[*] ? (@.action == "view")')) as granted from app_role where id = $1`, [user.roleid]);
    return !!r && (isManagerRole(r.name) || r.granted === true);
  }

  /** what the customer's page shows about care: review invitations sent, and complaints (only to those who may read them) */
  async care(customerId: number, user: any) {
    const invites = await this.manager.query(
      `select v.id, v.created_on, v.channel, s.bill_no as billno, st.location as store
         from review_invite v left join sale s on s.id = v.sale_id left join stores st on st.id = v.store_id
        where v.customer_id = $1 order by v.created_on desc, v.id desc limit 20`, [customerId]);
    const [c] = await this.manager.query(`select review_optout as "optOut" from customer where id = $1`, [customerId]);
    const grievances = (await this.canViewGrievances(user))
      ? await this.manager.query(
          `select id, summary, category, severity, status, due_on, created_on, resolved_on from grievance where customer_id = $1 order by created_on desc limit 20`, [customerId])
      : null;
    const snoozes = await this.manager.query(
      `select z.created_on, z.snoozed_until::text as until, z.reason, z.note, u.full_name as by_name
         from worklist_snooze z left join app_user u on u.id = z.created_by where z.customer_id = $1 order by z.created_on desc limit 5`, [customerId]);
    return { optOut: !!c?.optOut, invites, grievances, snoozes: snoozes.map((z: any) => ({ ...z, reason: SNOOZE_REASONS[z.reason] || z.reason })) };
  }
}
