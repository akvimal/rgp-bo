import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { ROLE, isOwnerRole } from 'src/core/roles';
import { StoreService } from '../store/store.service';
import { AlertDrafter, Draft, RECIPIENT_ROLES } from './alert-drafter';
import { DEFAULT_RULES, Finding, KINDS, SEVERITIES, cleanParams, kindOf } from './alert-kinds';
import { canSee } from './alert-access';
import { LANGUAGES, Lang, render } from './alert-messages';

const TZ = 'Asia/Kolkata';
const MAX_RULES = 50;
const SNOOZE_HOURS = [1, 4, 24];

interface Who { id: number; role: string; owner: boolean; businessId: number | null; storeIds: number[]; }

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private running = false;

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly stores: StoreService,
    private readonly drafter: AlertDrafter,
  ) {}

  // ------------------------------------------------------------------------------------------------ who is asking
  private async who(user: any): Promise<Who> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const [b] = await this.manager.query(`select ${BUSINESS_OF_USER_SQL} as business_id from app_user u where u.id = $1`, [user.id]);
    const stores = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    const role: string = r?.name || '';
    return { id: user.id, role, owner: isOwnerRole(role), businessId: b?.business_id ?? null, storeIds: stores.map((s: any) => s.store_id) };
  }

  private async owner(user: any): Promise<Who & { businessId: number }> {
    const w = await this.who(user);
    if (!w.owner || !w.businessId) throw new ForbiddenException('Only the owner can set up alerts.');
    return w as Who & { businessId: number };
  }

  private async language(userId: number): Promise<Lang> {
    const [p] = await this.manager.query(`select language from notification_pref where user_id = $1`, [userId]);
    return LANGUAGES.includes(p?.language) ? p.language : 'en';
  }

  // ------------------------------------------------------------------------------------------------ the engine
  /** each minute: look at every business's rules and bring its notifications up to date */
  @Cron(CronExpression.EVERY_MINUTE, { timeZone: TZ })
  async tick() {
    if (this.running) return;
    this.running = true;
    try { await this.runAll(); } catch (e: any) { this.logger.error(`Alert run failed: ${e?.message}`); } finally { this.running = false; }
  }

  async runAll() {
    const businesses = await this.manager.query(`select id from business where coalesce(archive, false) = false`);
    for (const b of businesses) await this.run(b.id);
  }

  private today(): string {
    return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  }

  /** the alerts a business starts with, added once (and again if it has none of a kind it should always have) */
  async ensureDefaults(businessId: number) {
    for (const d of DEFAULT_RULES) {
      const kind = kindOf(d.kind)!;
      await this.manager.query(
        `insert into alert_rule (business_id, kind, name, params, severity, source)
         select $1::int4, $2::varchar, $3::varchar, $4::jsonb, $5::varchar, 'system'
          where not exists (select 1 from alert_rule where business_id = $1::int4 and kind = $2::varchar and source = 'system')`,
        [businessId, d.kind, d.name, JSON.stringify(cleanParams(kind, {})), d.severity]);
    }
  }

  async run(businessId: number) {
    await this.ensureDefaults(businessId);
    const rules = await this.manager.query(`select * from alert_rule where business_id = $1 and not archive`, [businessId]);
    const ctx = { manager: this.manager, stores: this.stores, businessId, today: this.today() };
    for (const rule of rules) {
      const kind = kindOf(rule.kind);
      try {
        const found: Finding[] = rule.active && kind ? (await kind.evaluate(ctx, rule.params)).filter((f) => !rule.store_id || f.storeid === rule.store_id) : [];
        await this.reconcile(rule, found);
      } catch (e: any) {
        this.logger.error(`Alert rule ${rule.id} (${rule.kind}) failed: ${e?.message}`);
      }
    }
  }

  /** open what is newly found, update what is still true, close what has cleared */
  private async reconcile(rule: any, found: Finding[]) {
    const open = await this.manager.query(`select id, dedupe_key from notification where rule_id = $1 and resolved_on is null`, [rule.id]);
    const byKey = new Map<string, number>(open.map((o: any) => [o.dedupe_key, o.id]));
    const keys = new Set<string>();
    for (const f of found) {
      if (keys.has(f.key)) continue;
      keys.add(f.key);
      const severity = f.severity === 'critical' ? 'critical' : rule.severity;
      const id = byKey.get(f.key);
      if (id) {
        await this.manager.query(`update notification set severity = $2, code = $3, params = $4::jsonb, link = $5, store_id = $6 where id = $1`,
          [id, severity, f.code, JSON.stringify(f.params), f.link, f.storeid]);
      } else {
        await this.manager.query(
          `insert into notification (rule_id, business_id, store_id, dedupe_key, severity, code, params, link) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
           on conflict do nothing`,
          [rule.id, rule.business_id, f.storeid, f.key, severity, f.code, JSON.stringify(f.params), f.link]);
      }
    }
    const gone = open.filter((o: any) => !keys.has(o.dedupe_key)).map((o: any) => o.id);
    if (gone.length) await this.manager.query(`update notification set resolved_on = now() where id = any($1::int8[])`, [gone]);
  }

  /** the owner's "check now" */
  async runFor(user: any) {
    const w = await this.owner(user);
    await this.run(w.businessId);
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------------------ what a person sees
  async list(user: any, query: { status?: string; limit?: number }) {
    const w = await this.who(user);
    if (!w.businessId) return { unread: 0, items: [] };
    const lang = await this.language(user.id);
    const rows = await this.manager.query(
      `select n.id, n.store_id, n.severity, n.code, n.params, n.link, n.created_on, n.resolved_on, r.recipients, r.name as rule_name, s.location,
              st.read_on, st.dismissed_on, st.snoozed_until
         from notification n
         join alert_rule r on r.id = n.rule_id
         left join stores s on s.id = n.store_id
         left join notification_state st on st.notification_id = n.id and st.user_id = $1
        where n.business_id = $2 and (n.resolved_on is null or n.resolved_on > now() - interval '7 days')
        order by n.resolved_on is not null, case n.severity when 'critical' then 0 when 'warning' then 1 else 2 end, n.created_on desc
        limit 500`, [user.id, w.businessId]);
    const now = Date.now();
    const visible = rows.filter((r: any) => canSee(r.recipients, w, r.store_id));
    const live = (r: any) => !r.resolved_on && !r.dismissed_on && !(r.snoozed_until && new Date(r.snoozed_until).getTime() > now);
    const shown = query.status === 'all' ? visible : visible.filter(live);
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
    return {
      unread: visible.filter((r: any) => live(r) && !r.read_on).length,
      items: shown.slice(0, limit).map((r: any) => {
        const text = render(r.code, r.params, lang);
        return {
          id: Number(r.id), severity: r.severity, code: r.code, params: r.params, title: text.title, message: text.body, link: r.link,
          store: r.location ? String(r.location).trim() : null, rule: r.rule_name, createdon: r.created_on,
          status: r.resolved_on ? 'resolved' : r.dismissed_on ? 'dismissed' : (r.snoozed_until && new Date(r.snoozed_until).getTime() > now) ? 'snoozed' : 'open',
          read: !!r.read_on, snoozeduntil: r.snoozed_until,
        };
      }),
    };
  }

  /** a notification the person is allowed to see (so a person cannot mark another business's or another role's alert) */
  private async visibleOne(user: any, id: number) {
    const w = await this.who(user);
    const [n] = await this.manager.query(
      `select n.id, n.store_id, n.business_id, r.recipients from notification n join alert_rule r on r.id = n.rule_id where n.id = $1`, [id]);
    if (!n || n.business_id !== w.businessId || !canSee(n.recipients, w, n.store_id)) throw new NotFoundException('That notification is not here any more.');
    return n;
  }

  private async mark(user: any, id: number, column: string, value: any) {
    await this.visibleOne(user, id);
    await this.manager.query(
      `insert into notification_state (notification_id, user_id, ${column}) values ($1, $2, ${value})
       on conflict (notification_id, user_id) do update set ${column} = excluded.${column}`, [id, user.id]);
    return { ok: true };
  }

  read(user: any, id: number) { return this.mark(user, id, 'read_on', 'now()'); }
  dismiss(user: any, id: number) { return this.mark(user, id, 'dismissed_on', 'now()'); }

  async snooze(user: any, id: number, hours: number) {
    if (!SNOOZE_HOURS.includes(Number(hours))) throw new BadRequestException(`Snooze for ${SNOOZE_HOURS.join(', ')} hours.`);
    await this.visibleOne(user, id);
    await this.manager.query(
      `insert into notification_state (notification_id, user_id, snoozed_until) values ($1, $2, now() + make_interval(hours => $3::int))
       on conflict (notification_id, user_id) do update set snoozed_until = excluded.snoozed_until`, [id, user.id, Number(hours)]);
    return { ok: true };
  }

  async readAll(user: any) {
    const { items } = await this.list(user, { status: 'open', limit: 200 });
    const ids = items.filter((i: any) => !i.read).map((i: any) => i.id);
    if (ids.length) {
      await this.manager.query(
        `insert into notification_state (notification_id, user_id, read_on) select x, $2, now() from unnest($1::int8[]) x
         on conflict (notification_id, user_id) do update set read_on = coalesce(notification_state.read_on, now())`, [ids, user.id]);
    }
    return { ok: true, count: ids.length };
  }

  async prefs(user: any) { return { language: await this.language(user.id), languages: LANGUAGES }; }

  async savePrefs(user: any, body: any) {
    if (!LANGUAGES.includes(body?.language)) throw new BadRequestException('Choose English or Tamil.');
    await this.manager.query(
      `insert into notification_pref (user_id, language) values ($1, $2) on conflict (user_id) do update set language = excluded.language`, [user.id, body.language]);
    return this.prefs(user);
  }

  // ------------------------------------------------------------------------------------------------ rules (the owner's)
  /** what can be watched, and whether the assistant (a sentence in, a draft out) is switched on for this server */
  kinds() {
    return {
      assistant: this.drafter.configured,
      kinds: KINDS.map((k) => ({ kind: k.kind, label: k.label, description: k.description, params: k.params, defaultSeverity: k.defaultSeverity })),
    };
  }

  private shape(r: any) {
    const kind = kindOf(r.kind);
    return {
      id: r.id, kind: r.kind, kindlabel: kind?.label || r.kind, name: r.name, params: r.params, severity: r.severity, recipients: r.recipients,
      storeid: r.store_id, store: r.location ? String(r.location).trim() : null, active: r.active, source: r.source, instruction: r.instruction,
      open: Number(r.open || 0),
    };
  }

  async rules(user: any) {
    const w = await this.owner(user);
    await this.ensureDefaults(w.businessId);
    const rows = await this.manager.query(
      `select r.*, s.location, (select count(*) from notification n where n.rule_id = r.id and n.resolved_on is null) as open
         from alert_rule r left join stores s on s.id = r.store_id where r.business_id = $1 and not r.archive order by r.source = 'system' desc, r.id`, [w.businessId]);
    return rows.map((r: any) => this.shape(r));
  }

  private async validated(w: { businessId: number }, body: any, existing?: any) {
    const kind = kindOf(existing?.kind || body?.kind);
    if (!kind) throw new BadRequestException('Choose what to watch.');
    let params: Record<string, number>;
    try { params = cleanParams(kind, body?.params ?? existing?.params); } catch (e: any) { throw new BadRequestException(e.message); }
    const name = String(body?.name ?? existing?.name ?? kind.label).trim();
    if (!name || name.length > 120) throw new BadRequestException('Give the alert a name of up to 120 characters.');
    const severity = body?.severity ?? existing?.severity ?? kind.defaultSeverity;
    if (!SEVERITIES.includes(severity)) throw new BadRequestException('Severity must be info, warning or critical.');
    const roles: string[] = body?.recipients?.roles ?? existing?.recipients?.roles ?? ['owners', 'managers'];
    if (!Array.isArray(roles) || !roles.length || roles.some((x) => !RECIPIENT_ROLES.includes(x))) throw new BadRequestException('Choose who should see it: owners, store heads, staff.');
    const storeid = body?.storeid === undefined ? (existing?.store_id ?? null) : (body.storeid ? Number(body.storeid) : null);
    if (storeid) {
      const [s] = await this.manager.query(`select id from stores where id = $1 and business_id = $2 and not archive`, [storeid, w.businessId]);
      if (!s) throw new BadRequestException('That store is not part of this business.');
    }
    return { kind: kind.kind, params, name, severity, recipients: { roles: Array.from(new Set(roles)), userids: [] }, storeid };
  }

  async createRule(user: any, body: any) {
    const w = await this.owner(user);
    const [c] = await this.manager.query(`select count(*)::int as n from alert_rule where business_id = $1 and not archive`, [w.businessId]);
    if (c.n >= MAX_RULES) throw new BadRequestException(`A business can have up to ${MAX_RULES} alerts. Remove one you do not need.`);
    const v = await this.validated(w, body);
    const source = body?.fromassistant ? 'agent' : 'person';
    const instruction = source === 'agent' ? String(body.instruction || '').slice(0, 500) : null;
    const [row] = await this.manager.query(
      `insert into alert_rule (business_id, store_id, kind, name, params, severity, recipients, source, instruction, created_by)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10) returning id`,
      [w.businessId, v.storeid, v.kind, v.name, JSON.stringify(v.params), v.severity, JSON.stringify(v.recipients), source, instruction, user.id]);
    await this.run(w.businessId);
    return (await this.rules(user)).find((r: any) => r.id === row.id);
  }

  private async ownRule(w: { businessId: number }, id: number) {
    const [r] = await this.manager.query(`select * from alert_rule where id = $1 and business_id = $2 and not archive`, [id, w.businessId]);
    if (!r) throw new NotFoundException('Alert not found.');
    return r;
  }

  async updateRule(user: any, id: number, body: any) {
    const w = await this.owner(user);
    const existing = await this.ownRule(w, id);
    const v = await this.validated(w, body, existing);
    const active = body?.active === undefined ? existing.active : !!body.active;
    await this.manager.query(
      `update alert_rule set store_id = $2, name = $3, params = $4::jsonb, severity = $5, recipients = $6::jsonb, active = $7, updated_on = now() where id = $1`,
      [id, v.storeid, v.name, JSON.stringify(v.params), v.severity, JSON.stringify(v.recipients), active]);
    await this.run(w.businessId);
    return (await this.rules(user)).find((r: any) => r.id === id);
  }

  async removeRule(user: any, id: number) {
    const w = await this.owner(user);
    const existing = await this.ownRule(w, id);
    if (existing.source === 'system') throw new BadRequestException('The built-in alerts cannot be removed. Switch it off instead.');
    await this.manager.query(`update alert_rule set archive = true, active = false, updated_on = now() where id = $1`, [id]);
    await this.manager.query(`update notification set resolved_on = now() where rule_id = $1 and resolved_on is null`, [id]);
    return { ok: true };
  }

  /** what a rule would raise right now, without saving it */
  async preview(user: any, body: any) {
    const w = await this.owner(user);
    const v = await this.validated(w, body);
    const lang = await this.language(user.id);
    const found = (await kindOf(v.kind)!.evaluate({ manager: this.manager, stores: this.stores, businessId: w.businessId, today: this.today() }, v.params))
      .filter((f) => !v.storeid || f.storeid === v.storeid);
    return {
      count: found.length,
      items: found.slice(0, 20).map((f) => ({ ...render(f.code, f.params, lang), severity: f.severity === 'critical' ? 'critical' : v.severity })),
    };
  }

  /** the assistant's draft of a rule from a sentence; nothing is saved until the owner confirms it */
  async draft(user: any, body: any): Promise<{ draft: Draft; preview: any }> {
    const w = await this.owner(user);
    const stores = await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive order by id`, [w.businessId]);
    const draft = await this.drafter.draft(body?.instruction, stores.map((s: any) => ({ id: s.id, location: String(s.location).trim() })), w.businessId);
    return { draft, preview: await this.preview(user, draft) };
  }
}
