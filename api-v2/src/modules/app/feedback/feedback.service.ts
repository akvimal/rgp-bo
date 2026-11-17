import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { sep } from 'path';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser, BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { NOT_A_PERSON } from 'src/core/roles';
import { uploadedFilePath } from 'src/modules/app/files/upload-path';
import {
  canReporterClose, canReporterReopen, cleanMessage, cleanReport, FeedbackStatus, FINISHED, flagsAfter, KIND_LABEL, MAX_FILES, MAX_PER_DAY, Resolution, RESOLUTION_LABEL, resolveProblem, STATUS_LABEL,
  ticketFromText, ticketNo, autoCloseReason, closeNote, daysUntilClose, idleDaysBetween, LIFECYCLE, reopenAllowed,
  statusAfterReporterReply, statusAfterStaffReply, statusProblem,
} from './feedback-rules';

interface Me { id: number; roleId: number; business: number | null; manage: boolean; name: string }
type File = { path: string; name: string };

/**
 * App feedback: a report (something wrong, a question, a suggestion, wrong data) with the module and feature it is about, and a thread of replies.
 * The reporter sees their own reports and every reply except internal notes; managers (feedback.manage) see the business's inbox, reply, change the
 * status and assign. The two flags awaiting_staff and reporter_unread feed the alerts (feedback_waiting, feedback_reply).
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly audit: AuditService, @InjectEntityManager() private readonly manager: EntityManager) {}

  // ---------------------------------------------------------------- who is asking
  async can(roleId: number | string, action: string): Promise<boolean> {
    const [r] = await this.manager.query(
      `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                       where r.id = $1 and e->>'resource' = 'feedback' and p->>'action' = $2) as can`, [roleId, action]);
    return !!r?.can;
  }

  private async me(user: any): Promise<Me> {
    const [u] = await this.manager.query(`select u.id, u.full_name, u.role_id from app_user u where u.id = $1`, [user.id]);
    if (!u) throw new ForbiddenException();
    return { id: u.id, roleId: u.role_id, business: await businessOfUser(this.manager, u.id), manage: await this.can(u.role_id, 'manage'), name: u.full_name };
  }

  private isReporter(r: any, me: Me) { return r.reporter_user_id === me.id || r.created_by === me.id; }

  /** a report this person may open: their own, or any of the business's for a manager */
  private async load(me: Me, id: number, em: EntityManager = this.manager) {
    const [r] = await em.query(
      `select f.*, to_char(f.created_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as created_txt,
              ru.full_name as reporter_name, au.full_name as assignee_name, cu.full_name as sent_by_name
         from app_feedback f join app_user ru on ru.id = f.reporter_user_id join app_user cu on cu.id = f.created_by left join app_user au on au.id = f.assignee_user_id
        where f.id = $1 and not f.archive`, [id]);
    if (!r || !(this.isReporter(r, me) || (me.manage && r.business_id === me.business))) throw new NotFoundException('That report was not found.');
    return r;
  }

  private cleanFiles(raw: any): File[] {
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > MAX_FILES) throw new BadRequestException(`Attach up to ${MAX_FILES} files.`);
    return list.map((f: any) => {
      const path = String(f?.path ?? '');
      const full = uploadedFilePath(path);                                   // an existing file under the upload folder, nothing else
      if (!full.includes(`${sep}feedback${sep}`)) throw new BadRequestException('That file was not uploaded for a report.');
      return { path, name: String(f?.name ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 120) || 'file' };
    });
  }

  async options(user: any) {
    const me = await this.me(user);
    const staff = me.manage && me.business
      ? await this.manager.query(
          `select u.id, u.full_name as name from app_user u join app_role r on r.id = u.role_id
            where u.active and not u.archive and ${BUSINESS_OF_USER_SQL} = $1 and r.name <> all($2::text[])
              and exists (select 1 from json_array_elements(r.permissions) e, json_array_elements(e->'policies') p where e->>'resource' = 'feedback' and p->>'action' = 'manage')
            order by u.full_name`, [me.business, NOT_A_PERSON])
      : [];
    return { manage: me.manage, staff, max_files: MAX_FILES };
  }

  // ---------------------------------------------------------------- sending
  async create(user: any, body: any, followUpOf: number | null = null) {
    const me = await this.me(user);
    if (!me.business) throw new ForbiddenException('You are not placed in a business yet.');
    const c = cleanReport(body);
    if (!c.ok) throw new BadRequestException(c.message);
    const v = c.value;
    const files = this.cleanFiles(body?.files);
    const [{ n }] = await this.manager.query(`select count(*)::int as n from app_feedback where created_by = $1 and created_on >= now() - interval '1 day'`, [me.id]);
    if (n >= MAX_PER_DAY) throw new BadRequestException(`You have sent ${MAX_PER_DAY} reports today; please wait until tomorrow or add to one you already sent.`);

    // a shared counter login sends for whoever was serving
    let reporter = me.id;
    const acting = Number(body?.actinguserid);
    if (acting && acting !== me.id) {
      const [a] = await this.manager.query(
        `select u.id from app_user u join app_role ro on ro.id = u.role_id where u.id = $1 and u.active and not u.archive and ro.name <> all($2::text[]) and ${BUSINESS_OF_USER_SQL} = $3`, [acting, NOT_A_PERSON, me.business]);
      if (a) reporter = a.id;
    }
    const [store] = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive order by is_primary desc, id limit 1`, [me.id]);
    const [row] = await this.manager.query(
      `insert into app_feedback (business_id, store_id, kind, module_id, module_title, feature, title, details, impact, files, reporter_user_id, created_by, context, follow_up_of)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13::jsonb,$14) returning id`,
      [me.business, store?.store_id ?? null, v.kind, v.moduleId, v.moduleTitle, v.feature, v.title, JSON.stringify(v.details), v.impact, files.length ? JSON.stringify(files) : null, reporter, me.id, JSON.stringify(v.context), followUpOf]);
    await this.audit.record({ userId: me.id, actingUserId: reporter !== me.id ? reporter : undefined, action: 'feedback.created', entityType: 'app_feedback', entityId: row.id,
      summary: `${KIND_LABEL[v.kind]} about ${v.moduleTitle}: ${v.title}`, details: { module: v.moduleTitle, feature: v.feature } });
    return { id: row.id };
  }

  // ---------------------------------------------------------------- lists
  async mine(user: any) {
    const me = await this.me(user);
    const rows = await this.manager.query(
      `select f.id, f.kind, f.title, f.module_title, f.feature, f.status, f.resolution_code, f.impact, f.reporter_unread, f.last_activity_on, f.created_on, f.resolved_on
         from app_feedback f where not f.archive and (f.reporter_user_id = $1 or f.created_by = $1) order by f.last_activity_on desc limit 200`, [me.id]);
    return { items: rows.map((r: any) => ({ ...r, status_label: STATUS_LABEL[r.status as FeedbackStatus], kind_label: KIND_LABEL[r.kind as keyof typeof KIND_LABEL] })), unread: rows.filter((r: any) => r.reporter_unread).length };
  }

  /** the managers' inbox: awaiting (they owe a reply), open, done, or all; narrowed by kind, module and a word */
  async inbox(user: any, q: { view?: string; kind?: string; module?: string; q?: string }) {
    const me = await this.me(user);
    if (!me.manage || !me.business) throw new ForbiddenException('The inbox is for the people who answer reports.');
    const view = ['awaiting', 'open', 'done', 'all'].includes(String(q.view)) ? String(q.view) : 'awaiting';
    const where: string[] = ['f.business_id = $1', 'not f.archive'];
    const args: any[] = [me.business];
    if (view === 'awaiting') where.push(`f.awaiting_staff and f.status <> 'CLOSED'`);
    if (view === 'open') where.push(`f.status not in ('ANSWERED','DECLINED','DUPLICATE','CLOSED')`);
    if (view === 'done') where.push(`f.status in ('ANSWERED','DECLINED','DUPLICATE','CLOSED')`);
    if (q.kind) { args.push(String(q.kind)); where.push(`f.kind = $${args.length}`); }
    if (q.module) { args.push(String(q.module).slice(0, 60)); where.push(`f.module_id = $${args.length}`); }
    const byNumber = ticketFromText(q.q);
    if (byNumber) { args.push(byNumber); where.push(`f.id = $${args.length}`); }
    else if (q.q && String(q.q).trim()) { args.push(`%${String(q.q).trim().slice(0, 60).replace(/[%_\\]/g, '\\$&')}%`); where.push(`(f.title ilike $${args.length} or f.details::text ilike $${args.length})`); }
    const rows = await this.manager.query(
      `select f.id, f.kind, f.title, f.module_id, f.module_title, f.feature, f.status, f.resolution_code, f.impact, f.awaiting_staff, f.last_activity_on, f.created_on,
              ru.full_name as reporter_name, au.full_name as assignee_name
         from app_feedback f join app_user ru on ru.id = f.reporter_user_id left join app_user au on au.id = f.assignee_user_id
        where ${where.join(' and ')}
        order by f.awaiting_staff desc, (f.impact = 'blocks') desc, f.last_activity_on desc limit 300`, args);
    const [counts] = await this.manager.query(
      `select count(*) filter (where awaiting_staff and status <> 'CLOSED')::int as awaiting, count(*) filter (where status not in ('ANSWERED','DECLINED','DUPLICATE','CLOSED'))::int as open
         from app_feedback where business_id = $1 and not archive`, [me.business]);
    return { items: rows.map((r: any) => ({ ...r, status_label: STATUS_LABEL[r.status as FeedbackStatus], kind_label: KIND_LABEL[r.kind as keyof typeof KIND_LABEL] })), counts };
  }

  // ---------------------------------------------------------------- one report
  async get(user: any, id: number) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    const reporter = this.isReporter(r, me);
    const notes = await this.manager.query(
      `select n.id, n.kind, n.body, n.files, n.created_on, u.full_name as author,
              (n.created_by is distinct from $2 and n.created_by is distinct from $3) as by_staff
         from app_feedback_note n join app_user u on u.id = n.created_by
        where n.feedback_id = $1 ${me.manage && !reporter ? '' : `and n.kind <> 'INTERNAL'`} order by n.created_on, n.id`, [r.id, r.reporter_user_id, r.created_by]);
    // opening it is reading it
    if (reporter && r.reporter_unread) await this.manager.query(`update app_feedback set reporter_unread = false where id = $1`, [r.id]);
    return {
      id: r.id, kind: r.kind, kind_label: KIND_LABEL[r.kind as keyof typeof KIND_LABEL], title: r.title, module_id: r.module_id, module_title: r.module_title, feature: r.feature,
      ticket: ticketNo(r.id), closed_on: r.closed_on, follow_up_of: r.follow_up_of, follow_up_ticket: r.follow_up_of ? ticketNo(r.follow_up_of) : null,
      follow_ups: (await this.manager.query(`select id, title, status from app_feedback where follow_up_of = $1 and not archive ${me.manage && !reporter ? '' : 'and (reporter_user_id = $2 or created_by = $2)'} order by id`, me.manage && !reporter ? [r.id] : [r.id, me.id]))
        .map((x: any) => ({ id: x.id, ticket: ticketNo(x.id), title: x.title, status: x.status })),
      closes_in_days: daysUntilClose(r.status, idleDaysBetween(r.last_activity_on)), reopen_window_days: LIFECYCLE.reopenWindowDays,
      details: r.details, impact: r.impact, files: r.files || [], status: r.status, status_label: STATUS_LABEL[r.status as FeedbackStatus], resolution: r.resolution,
      resolution_code: r.resolution_code, resolution_label: r.resolution_code ? RESOLUTION_LABEL[r.resolution_code as Resolution] : null,
      resolved_on: r.resolved_on, duplicate_of: r.duplicate_of, created_on: r.created_on, last_activity_on: r.last_activity_on,
      reporter_name: r.reporter_name, assignee_name: r.assignee_name, assignee_user_id: r.assignee_user_id, awaiting_staff: r.awaiting_staff,
      context: me.manage ? r.context : undefined,
      notes,
      can: {
        // a closed report is read-only: the reporter reopens it, a manager moves it with the status
        reply: r.status !== 'CLOSED',
        close: reporter && canReporterClose(r.status),
        reopen: reporter && canReporterReopen(r.status) && reopenAllowed(r.status, r.closed_on),
        // closed too long ago to reopen: a new report that links back
        followup: reporter && r.status === 'CLOSED' && !reopenAllowed(r.status, r.closed_on),
        manage: me.manage && !reporter,
        // resolve while it is being worked on; close once it has ended
        resolve: me.manage && !reporter && !FINISHED.includes(r.status),
        closeTicket: me.manage && !reporter && FINISHED.includes(r.status) && r.status !== 'CLOSED',
      },
    };
  }

  // ---------------------------------------------------------------- writing back
  /** a reply from the reporter (back to the managers) or from a manager (to the reporter); an internal note changes nothing */
  async reply(user: any, id: number, body: any) {
    const me = await this.me(user);
    const message = cleanMessage(body?.message);
    if (!message) throw new BadRequestException('Write your reply.');
    const files = this.cleanFiles(body?.files);
    return this.manager.transaction(async (em) => {
      const r = await this.load(me, id, em);
      const reporter = this.isReporter(r, me);
      const status = r.status as FeedbackStatus;
      if (!reporter && body?.internal) {
        await em.query(`insert into app_feedback_note (feedback_id, kind, body, files, created_by) values ($1,'INTERNAL',$2,$3::jsonb,$4)`, [r.id, message, files.length ? JSON.stringify(files) : null, me.id]);
        return { id: r.id };
      }
      if (reporter) {
        const next = statusAfterReporterReply(status);
        if (next === 'CLOSED_REFUSED') throw new BadRequestException('This report is closed. Reopen it to write again.');
        await em.query(`insert into app_feedback_note (feedback_id, kind, body, files, created_by) values ($1,'REPLY',$2,$3::jsonb,$4)`, [r.id, message, files.length ? JSON.stringify(files) : null, me.id]);
        const f = flagsAfter('reporter');
        await em.query(`update app_feedback set status = $2, awaiting_staff = $3, reporter_unread = $4, last_activity_on = now() where id = $1`, [r.id, next, f.awaiting_staff, f.reporter_unread]);
      } else {
        const next = statusAfterStaffReply(status, !!body?.wait);
        await em.query(`insert into app_feedback_note (feedback_id, kind, body, files, created_by) values ($1,'REPLY',$2,$3::jsonb,$4)`, [r.id, message, files.length ? JSON.stringify(files) : null, me.id]);
        const f = flagsAfter('staff');
        await em.query(`update app_feedback set status = $2, awaiting_staff = $3, reporter_unread = $4, last_activity_on = now() where id = $1`, [r.id, next, f.awaiting_staff, f.reporter_unread]);
      }
      return { id: r.id };
    });
  }

  /** a manager's status change; answered and not-planned carry the words the reporter reads, a duplicate points to the first report */
  async setStatus(user: any, id: number, body: any) {
    const me = await this.me(user);
    if (!me.manage) throw new ForbiddenException('Only the people who answer reports can change the status.');
    const problem = statusProblem(body);
    if (problem) throw new BadRequestException(problem);
    const status = String(body.status) as FeedbackStatus;
    const resolution = cleanMessage(body?.resolution);
    return this.applyStatus(me, id, status, resolution, body?.duplicate_of, null);
  }

  /** a manager resolves a report in one step: how it ended, and the words the reporter reads */
  async resolve(user: any, id: number, body: any) {
    const me = await this.me(user);
    if (!me.manage) throw new ForbiddenException('Only the people who answer reports can resolve them.');
    const r = resolveProblem(body);
    if ('problem' in r) throw new BadRequestException(r.problem);
    return this.applyStatus(me, id, r.status, r.note, body?.duplicate_of, r.code);
  }

  private async applyStatus(me: Me, id: number, status: FeedbackStatus, resolution: string | null, duplicateOf: any, code: Resolution | null) {
    return this.manager.transaction(async (em) => {
      const r = await this.load(me, id, em);
      if (this.isReporter(r, me)) throw new ForbiddenException('Someone else answers your own report.');
      let dup: number | null = null;
      if (status === 'DUPLICATE') {
        dup = Number(duplicateOf);
        if (dup === r.id) throw new BadRequestException('A report cannot repeat itself.');
        const [first] = await em.query(`select id from app_feedback where id = $1 and business_id = $2 and not archive`, [dup, r.business_id]);
        if (!first) throw new BadRequestException('There is no report with that number.');
      }
      const finished = FINISHED.includes(status);
      await em.query(
        `update app_feedback set status = $2, resolution = coalesce($3, resolution), duplicate_of = $4, resolved_on = case when $5 then now() else null end,
                resolved_by = case when $5 then $6::int else null end, resolution_code = case when $5 then coalesce($7, resolution_code) else null end,
                closed_on = case when $9 then now() else null end,
                awaiting_staff = false, reporter_unread = $8, last_activity_on = now() where id = $1`,
        [r.id, status, resolution, dup, finished, me.id, code, status !== 'CLOSED', status === 'CLOSED']);
      const how = code ? RESOLUTION_LABEL[code] : null;
      await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS',$2,$3)`,
        [r.id, `${how && status === 'ANSWERED' ? 'Resolved: ' + how : 'Status: ' + STATUS_LABEL[status]}${dup ? ` (same as ${ticketNo(dup)})` : ''}`, me.id]);
      if (resolution) await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'REPLY',$2,$3)`, [r.id, resolution, me.id]);
      await this.audit.record({ userId: me.id, action: 'feedback.status', entityType: 'app_feedback', entityId: r.id, summary: `${ticketNo(r.id)} set to ${STATUS_LABEL[status]}${how ? ` (${how})` : ''}`, details: { status, resolution: code } });
      return { id: r.id };
    });
  }

  async assign(user: any, id: number, body: any) {
    const me = await this.me(user);
    if (!me.manage) throw new ForbiddenException('Only the people who answer reports can assign them.');
    const r = await this.load(me, id);
    const to = body?.user_id ? Number(body.user_id) : null;
    if (to) {
      const staff = (await this.options(user)).staff as { id: number }[];
      if (!staff.some((s) => s.id === to)) throw new BadRequestException('Choose one of the people who answer reports.');
    }
    await this.manager.query(`update app_feedback set assignee_user_id = $2 where id = $1`, [r.id, to]);
    return { id: r.id };
  }

  /** the reporter says it is solved */
  async close(user: any, id: number) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    if (!this.isReporter(r, me)) throw new ForbiddenException('Only the person who sent it can close it.');
    if (!canReporterClose(r.status)) throw new BadRequestException('It can be closed once it has been answered.');
    await this.manager.query(`update app_feedback set status = 'CLOSED', closed_on = now(), awaiting_staff = false, reporter_unread = false, resolved_on = coalesce(resolved_on, now()), last_activity_on = now() where id = $1`, [r.id]);
    await this.manager.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS','Status: Closed (the reporter says it is solved)',$2)`, [r.id, me.id]);
    return { id: r.id };
  }

  /** the reporter is not satisfied: back to the managers with a message */
  async reopen(user: any, id: number, body: any) {
    const me = await this.me(user);
    const message = cleanMessage(body?.message);
    if (!message) throw new BadRequestException('Say what is still not right.');
    return this.manager.transaction(async (em) => {
      const r = await this.load(me, id, em);
      if (!this.isReporter(r, me)) throw new ForbiddenException('Only the person who sent it can reopen it.');
      if (!canReporterReopen(r.status)) throw new BadRequestException('It is still being looked into; just reply.');
      if (!reopenAllowed(r.status, r.closed_on)) throw new BadRequestException(`It was closed more than ${LIFECYCLE.reopenWindowDays} days ago, so it cannot be reopened. Raise a follow-up instead; it links back to this one.`);
      await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS','Status: Reopened by the reporter',$2)`, [r.id, me.id]);
      await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'REPLY',$2,$3)`, [r.id, message, me.id]);
      const f = flagsAfter('reporter');
      await em.query(`update app_feedback set status = 'IN_PROGRESS', resolved_on = null, resolved_by = null, resolution_code = null, closed_on = null, awaiting_staff = $2, reporter_unread = $3, last_activity_on = now() where id = $1`, [r.id, f.awaiting_staff, f.reporter_unread]);
      return { id: r.id };
    });
  }

  // ---------------------------------------------------------------- a follow-up after the reopen window
  /** a new report about one that closed too long ago to reopen: the same module and feature, linked both ways */
  async followUp(user: any, id: number, body: any) {
    const me = await this.me(user);
    const r = await this.load(me, id);
    if (!this.isReporter(r, me)) throw new ForbiddenException('Only the person who sent it can raise a follow-up.');
    if (r.status !== 'CLOSED') throw new BadRequestException('It is still open: just reply or reopen it.');
    if (reopenAllowed(r.status, r.closed_on)) throw new BadRequestException('It was closed recently, so reopen it instead.');
    const message = cleanMessage(body?.message);
    if (!message) throw new BadRequestException('Say what is still not right.');
    const kind = r.kind as string;
    const details = kind === 'suggestion' ? { goal: message } : { what: message, expected: undefined };
    const made = await this.create(user, {
      kind, module_id: r.module_id, module_title: r.module_title, feature: r.feature, title: `Follow-up: ${String(r.title)}`.slice(0, 120),
      details, impact: r.impact, context: { route: r.context?.route ?? null, version: null, browser: null },
    }, r.id);
    await this.manager.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS',$2,$3)`, [made.id, `Follow-up to ${ticketNo(r.id)}`, me.id]);
    await this.manager.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS',$2,$3)`, [r.id, `Follow-up raised: ${ticketNo(made.id)}`, me.id]);
    return { id: made.id };
  }

  // ---------------------------------------------------------------- closing what has gone quiet
  private readonly log = new Logger(FeedbackService.name);

  /** each night: a question the reporter never answered, and a report that has ended and drawn no reply, are closed */
  @Cron('0 20 3 * * *', { timeZone: 'Asia/Kolkata' })
  async nightly() {
    try { const n = await this.closeQuiet(); if (n) this.log.log(`${n} quiet report(s) closed`); } catch (e: any) { this.log.warn(`Closing quiet reports failed: ${e?.message}`); }
  }

  /** a manager runs it now (the same as the night's run); returns how many were closed */
  async sweep(user: any) {
    const me = await this.me(user);
    if (!me.manage) throw new ForbiddenException('Only the people who answer reports can do this.');
    return { closed: await this.closeQuiet(me.business) };
  }

  async closeQuiet(businessId: number | null = null): Promise<number> {
    const rows = await this.manager.query(
      `select id, status, coalesce(resolved_by, assignee_user_id, created_by) as author, last_activity_on
         from app_feedback where not archive and status in ('WAITING', 'ANSWERED', 'DECLINED', 'DUPLICATE') and ($1::int is null or business_id = $1)`, [businessId]);
    let closed = 0;
    for (const f of rows) {
      const reason = autoCloseReason(f.status as FeedbackStatus, idleDaysBetween(f.last_activity_on));
      if (!reason) continue;
      const done = await this.manager.transaction(async (em) => {
        // only if it is still as quiet as it was read: a reply a second ago wins
        const upd = await em.query(
          `update app_feedback set status = 'CLOSED', closed_on = now(), resolution_code = case when $3::text = 'no_response' then 'no_response' else resolution_code end,
                  resolved_on = coalesce(resolved_on, now()), awaiting_staff = false, reporter_unread = true, last_activity_on = now()
            where id = $1 and status = $2 and extract(epoch from (now() - last_activity_on)) / 86400 >= $4::numeric returning id`,
          [f.id, f.status, reason, reason === 'no_response' ? LIFECYCLE.closeWaitingDays : LIFECYCLE.closeEndedDays]);
        if (!upd.length) return false;
        await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS',$2,$3)`, [f.id, closeNote(reason), f.author]);
        return true;
      });
      if (done) {
        closed++;
        await this.audit.record({ userId: f.author, action: 'feedback.auto_closed', entityType: 'app_feedback', entityId: f.id, summary: `${ticketNo(f.id)} ${closeNote(reason).toLowerCase()}`, details: { reason } });
      }
    }
    return closed;
  }
}
