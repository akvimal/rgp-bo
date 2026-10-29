import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ConfigService } from 'src/core/config/config.service';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { isManagerRole, isOwnerRole, NOT_A_PERSON } from 'src/core/roles';
import { packsOf } from 'src/core/modules/modules';
import { activityRun, beatCount, captureRun, cleanDays, decide, discountSpike, RULES, RuleDef, standing, Standing, tillStreak } from './recognition-rules';

const TZ = 'Asia/Kolkata';
const FRESH_MS = 30 * 60 * 1000;
const CAPTURE_DAYS = 7;
const MS = 86400000;
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * MS).toISOString().slice(0, 10);

interface Who { id: number; owner: boolean; manager: boolean; businessId: number; storeIds: number[] }
interface Measure { rule: RuleDef; st: Standing; broken: boolean; evidence: any }

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);
  private lastRun = new Map<number, number>();

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private async today(): Promise<string> {
    const [r] = await this.manager.query(`select (now() at time zone '${TZ}')::date::text as d`);
    return r.d;
  }

  private async who(user: any): Promise<Who> {
    const businessId = await businessOfUser(this.manager, user?.id || 0);
    if (!businessId) throw new ForbiddenException('Your user is not linked to a business.');
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const owner = isOwnerRole(role?.name);
    const rows = owner
      ? await this.manager.query(`select id as store_id from stores where business_id = $1 and active and not archive`, [businessId])
      : await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id, owner, manager: isManagerRole(role?.name), businessId, storeIds: rows.map((r: any) => +r.store_id) };
  }

  // ------------------------------------------------------------------ measuring: what each person's habits say today

  /** the people a business recognises: everyone with a login of their own who billed lately (a shared counter login is not a person) */
  private async measure(businessId: number, today: string, only?: number): Promise<Map<number, Measure[]>> {
    const m = this.manager;
    const cfg = await this.config.valuesFor(businessId, 'recognition');
    const [b] = await m.query(`select business_type from business where id = $1`, [businessId]);
    const packs = packsOf(b?.business_type ?? 'pharmacy');
    const rules = RULES.filter((r) => (!r.pack || packs.includes(r.pack)) && cfg[r.onKey] !== false);
    const onlyArr = only ? [only] : null;

    const daily = await m.query(
      `select coalesce(s.acting_user_id, s.created_by) as person, s.bill_date::date::text as d, sum(s.total)::float as sales, count(*)::int as bills,
              count(*) filter (where c.mobile is not null and c.mobile !~ '^0*$')::int as with_mobile, coalesce(sum(s.disc_amount), 0)::float as disc
         from sale s join stores st on st.id = s.store_id left join customer c on c.id = s.customer_id
         join app_user u on u.id = coalesce(s.acting_user_id, s.created_by) join app_role r on r.id = u.role_id
        where st.business_id = $1 and s.status = 'COMPLETE' and s.bill_date >= current_date - 70 and r.name <> all($2::text[])
          and ($3::int[] is null or coalesce(s.acting_user_id, s.created_by) = any($3::int[]))
        group by 1, 2`, [businessId, NOT_A_PERSON, onlyArr]);
    const shifts = await m.query(
      `select coalesce(sh.closed_operator_id, sh.closed_by) as person, sh.variance::float as variance
         from store_shifts sh join stores st on st.id = sh.store_id
        where st.business_id = $1 and sh.status = 'CLOSED' and sh.closed_on >= now() - interval '90 days'
          and ($2::int[] is null or coalesce(sh.closed_operator_id, sh.closed_by) = any($2::int[]))
        order by sh.closed_on desc`, [businessId, onlyArr]);
    const refills = await m.query(
      `select created_by as person, (created_on at time zone '${TZ}')::date::text as d from refill_followup
        where created_on >= now() - interval '40 days' and ($1::int[] is null or created_by = any($1::int[])) group by 1, 2`, [onlyArr]);
    const lates = await m.query(
      `select i.person_id as person, to_char(max(e.created_on at time zone '${TZ}'), 'YYYY-MM-DD') as last
         from compliance_event e join compliance_instance i on i.id = e.instance_id
        where i.business_id = $1 and e.kind = 'step' and e.note in ('late', 'escalated') and i.person_id is not null group by 1`, [businessId]);

    const byPerson = new Map<number, Map<string, any>>();
    for (const r of daily) { if (!byPerson.has(+r.person)) byPerson.set(+r.person, new Map()); byPerson.get(+r.person)!.set(r.d, r); }
    if (only && !byPerson.has(only)) byPerson.set(only, new Map());   // a person who has not billed yet still sees their progress, at nothing
    const shiftBy = new Map<number, (number | null)[]>();
    for (const r of shifts) { if (r.person == null) continue; (shiftBy.get(+r.person) || shiftBy.set(+r.person, []).get(+r.person)!).push(r.variance); }
    const refillBy = new Map<number, Set<string>>();
    for (const r of refills) { if (r.person == null) continue; (refillBy.get(+r.person) || refillBy.set(+r.person, new Set()).get(+r.person)!).add(r.d); }
    const lateBy = new Map<number, string>(lates.map((r: any) => [+r.person, r.last]));

    const out = new Map<number, Measure[]>();
    for (const [person, days] of byPerson) {
      const ms: Measure[] = [];
      const yesterday = addDays(today, -1);
      const back = (n: number) => Array.from({ length: n }, (_, i) => addDays(yesterday, -i));   // newest first, complete days only
      for (const rule of rules) {
        if (rule.key === 'till') {
          const v = shiftBy.get(person) || [];
          const run = tillStreak(v);
          ms.push({ rule, st: standing(run, Number(cfg.till_streak) || 10), broken: run === 0 && v.length > 0, evidence: { shifts: run } });
        } else if (rule.key === 'capture') {
          const list = back(30).map((d) => ({ bills: days.get(d)?.bills || 0, withMobile: days.get(d)?.with_mobile || 0 }));
          const run = captureRun(list, Number(cfg.capture_pct) || 95);
          ms.push({ rule, st: standing(run, CAPTURE_DAYS), broken: run === 0, evidence: { days: run, pct: Number(cfg.capture_pct) || 95 } });
        } else if (rule.key === 'refill') {
          const set = refillBy.get(person) || new Set<string>();
          const run = activityRun(back(30).map((d) => set.has(d)));
          ms.push({ rule, st: standing(run, Number(cfg.refill_days) || 5), broken: run === 0, evidence: { days: run } });
        } else if (rule.key === 'beat') {
          const wk = back(7);
          const usualOf = (d: string) => {
            const dow = new Date(d + 'T00:00:00Z').getUTCDay();
            const hist = Array.from({ length: 8 }, (_, i) => addDays(d, -7 * (i + 1))).filter((x) => new Date(x + 'T00:00:00Z').getUTCDay() === dow).map((x) => days.get(x)?.sales).filter((x): x is number => typeof x === 'number');
            return hist.length >= 2 ? hist.reduce((a, c) => a + c, 0) / hist.length : null;
          };
          const list = wk.map((d) => ({ sales: days.get(d)?.sales || 0, usual: usualOf(d) }));
          const n = beatCount(list);
          const pct = (ds: string[]) => { let disc = 0, tot = 0; for (const d of ds) { const r = days.get(d); if (r) { disc += r.disc; tot += r.sales + r.disc; } } return tot > 0 ? (disc / tot) * 100 : null; };
          const weekPct = pct(wk) ?? 0, earlier = pct(back(35).slice(7));
          const spike = discountSpike(weekPct, earlier);
          ms.push({ rule, st: standing(spike ? 0 : n, Number(cfg.beat_days) || 5), broken: n <= 1, evidence: { days: n, paused: spike ? 'discounts rose' : null } });
        } else if (rule.key === 'clean') {
          const first = [...days.keys()].sort()[0] || null;
          const v = cleanDays(lateBy.get(person) || null, first, today);
          const activeRecently = [...days.keys()].some((d) => d >= addDays(today, -7));
          ms.push({ rule, st: standing(activeRecently ? v : 0, Number(cfg.clean_days) || 30), broken: v < 3, evidence: { days: v } });
        }
      }
      out.set(person, ms);
    }
    return out;
  }

  private async pausedPeople(businessId: number): Promise<Map<number, { label: string; step: string }[]>> {
    const rows = await this.manager.query(
      `select person_id, item_key, step from compliance_instance where business_id = $1 and state = 'OPEN' and person_id is not null and not not_mine and step in ('late', 'escalated')`, [businessId]);
    const map = new Map<number, { label: string; step: string }[]>();
    for (const r of rows) (map.get(+r.person_id) || map.set(+r.person_id, []).get(+r.person_id)!).push({ label: r.item_key, step: r.step });
    return map;
  }

  // ------------------------------------------------------------------ the nightly run: award what is earned, lapse what has broken

  @Cron('0 30 0 * * *', { timeZone: TZ })
  async nightly() {
    try {
      const biz = await this.manager.query(`select id from business where active and not archive`);
      for (const b of biz) await this.run(b.id);
    } catch (e: any) { this.logger.error(`recognition run failed: ${e?.message}`); }
  }

  async run(businessId: number): Promise<{ awarded: number; lapsed: number }> {
    const today = await this.today();
    const measures = await this.measure(businessId, today);
    const paused = await this.pausedPeople(businessId);
    const active = await this.manager.query(`select person_id, rule_key from recognition_award where business_id = $1 and lapsed_on is null`, [businessId]);
    const holds = new Set<string>(active.map((a: any) => `${a.person_id}|${a.rule_key}`));
    let awarded = 0, lapsed = 0;
    for (const [person, ms] of measures) {
      for (const x of ms) {
        const has = holds.has(`${person}|${x.rule.key}`);
        const act = decide(x.st, has, paused.has(person), x.broken);
        if (act === 'award') {
          const r = await this.manager.query(
            `insert into recognition_award (business_id, person_id, rule_key, awarded_on, evidence) values ($1,$2,$3,$4::date,$5::jsonb) on conflict do nothing returning id`,
            [businessId, person, x.rule.key, today, JSON.stringify({ ...x.evidence, target: x.st.target })]);
          if (r.length) awarded++;
        } else if (act === 'lapse') {
          await this.manager.query(`update recognition_award set lapsed_on = $4::date where business_id = $1 and person_id = $2 and rule_key = $3 and lapsed_on is null`, [businessId, person, x.rule.key, today]);
          lapsed++;
        }
      }
    }
    this.lastRun.set(businessId, Date.now());
    return { awarded, lapsed };
  }

  private async fresh(businessId: number) {
    if (Date.now() - (this.lastRun.get(businessId) || 0) > FRESH_MS) await this.run(businessId);
  }

  async runNow(user: any) {
    const w = await this.who(user);
    if (!w.owner) throw new ForbiddenException('Only the Business Head can run recognition now.');
    return this.run(w.businessId);
  }

  // ------------------------------------------------------------------ reading

  /** a person's own badges, what is close, whether new badges are paused by an item of theirs, and notes of thanks */
  async mine(user: any) {
    const w = await this.who(user);
    await this.fresh(w.businessId);
    const today = await this.today();
    const ms = (await this.measure(w.businessId, today, w.id)).get(w.id) || [];
    const awards = await this.manager.query(
      `select id, rule_key, to_char(awarded_on, 'YYYY-MM-DD') as awarded_on, evidence, seen_on is not null as seen, to_char(lapsed_on, 'YYYY-MM-DD') as lapsed_on
         from recognition_award where business_id = $1 and person_id = $2 order by awarded_on desc, id desc limit 40`, [w.businessId, w.id]);
    const paused = (await this.pausedPeople(w.businessId)).get(w.id) || [];
    const notes = await this.manager.query(
      `select n.id, n.text, u.full_name as from_name, to_char(n.created_on at time zone '${TZ}', 'YYYY-MM-DD') as at, n.seen_on is not null as seen
         from recognition_note n join app_user u on u.id = n.from_user where n.to_user = $1 order by n.created_on desc limit 10`, [w.id]);
    const activeKeys = new Set<string>(awards.filter((a: any) => !a.lapsed_on).map((a: any) => a.rule_key));
    return {
      paused: paused.length > 0,
      pausedBy: paused,
      awards: awards.map((a: any) => ({ ...a, name: RULES.find((r) => r.key === a.rule_key)?.name, how: RULES.find((r) => r.key === a.rule_key)?.how })),
      progress: ms.map((x) => ({ rule: x.rule.key, name: x.rule.name, how: x.rule.how, unit: x.rule.unit, value: x.st.value, target: x.st.target, earned: activeKeys.has(x.rule.key), note: x.evidence?.paused || null })),
      notes,
      unseen: awards.filter((a: any) => !a.seen && !a.lapsed_on).length + notes.filter((n: any) => !n.seen).length,
    };
  }

  async seen(user: any) {
    const w = await this.who(user);
    await this.manager.query(`update recognition_award set seen_on = now() where business_id = $1 and person_id = $2 and seen_on is null`, [w.businessId, w.id]);
    await this.manager.query(`update recognition_note set seen_on = now() where to_user = $1 and seen_on is null`, [w.id]);
    return { ok: true };
  }

  /** the people of the user's stores with the badges they hold, in name order: no ranking, no points */
  async team(user: any) {
    const w = await this.who(user);
    if (!w.manager) throw new ForbiddenException('The team page is for the Business Head and the Store Head.');
    await this.fresh(w.businessId);
    const people = await this.manager.query(
      `select distinct u.id, u.full_name as name, r.name as role from user_stores us join app_user u on u.id = us.user_id join app_role r on r.id = u.role_id
        where us.store_id = any($1::int[]) and us.active and not us.archive and u.active and not u.archive and r.name <> all($2::text[]) order by u.full_name`, [w.storeIds, NOT_A_PERSON]);
    const ids = people.map((p: any) => p.id);
    const awards = await this.manager.query(
      `select person_id, rule_key, to_char(awarded_on, 'YYYY-MM-DD') as awarded_on, (awarded_on >= current_date - 14) as recent from recognition_award
        where business_id = $1 and person_id = any($2::int[]) and lapsed_on is null order by awarded_on desc`, [w.businessId, ids]);
    const paused = await this.pausedPeople(w.businessId);
    const thanked = await this.manager.query(`select distinct to_user from recognition_note where from_user = $1 and created_on >= now() - interval '14 days'`, [w.id]);
    const thankedSet = new Set<number>(thanked.map((t: any) => +t.to_user));
    return people.map((p: any) => {
      const mine = awards.filter((a: any) => a.person_id === p.id);
      return {
        id: p.id, name: p.name, role: p.role,
        badges: mine.map((a: any) => ({ rule: a.rule_key, name: RULES.find((r) => r.key === a.rule_key)?.name, awardedOn: a.awarded_on })),
        recent: mine.some((a: any) => a.recent), paused: paused.has(p.id), thanked: thankedSet.has(p.id),
      };
    });
  }

  /** a one-line thanks to a person of the user's stores */
  async thank(user: any, body: { to: number; text: string }) {
    const w = await this.who(user);
    if (!w.manager) throw new ForbiddenException('Only a store head or the Business Head can send thanks.');
    const text = String(body?.text || '').trim();
    if (text.length < 3) throw new BadRequestException('Write a line of thanks.');
    const to = Number(body?.to);
    const [ok] = await this.manager.query(`select 1 as x from user_stores where user_id = $1 and store_id = any($2::int[]) and active and not archive`, [to, w.storeIds]);
    if (!ok) throw new ForbiddenException('That person is not in your stores.');
    await this.manager.query(`insert into recognition_note (business_id, from_user, to_user, text) values ($1,$2,$3,$4)`, [w.businessId, w.id, to, text.slice(0, 300)]);
    await this.audit.record({ userId: w.id, action: 'recognition.thanks', entityType: 'user', entityId: to, summary: 'Sent a note of thanks' });
    return { ok: true };
  }
}
