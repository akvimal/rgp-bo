import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { sep } from 'path';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser, BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { NOT_A_PERSON } from 'src/core/roles';
import { uploadedFilePath } from 'src/modules/app/files/upload-path';
import {
  canReporterClose, canReporterReopen, cleanMessage, cleanReport, FeedbackStatus, FINISHED, flagsAfter, KIND_LABEL, MAX_FILES, MAX_PER_DAY, STATUS_LABEL,
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
  async create(user: any, body: any) {
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
      `insert into app_feedback (business_id, store_id, kind, module_id, module_title, feature, title, details, impact, files, reporter_user_id, created_by, context)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13::jsonb) returning id`,
      [me.business, store?.store_id ?? null, v.kind, v.moduleId, v.moduleTitle, v.feature, v.title, JSON.stringify(v.details), v.impact, files.length ? JSON.stringify(files) : null, reporter, me.id, JSON.stringify(v.context)]);
    await this.audit.record({ userId: me.id, actingUserId: reporter !== me.id ? reporter : undefined, action: 'feedback.created', entityType: 'app_feedback', entityId: row.id,
      summary: `${KIND_LABEL[v.kind]} about ${v.moduleTitle}: ${v.title}`, details: { module: v.moduleTitle, feature: v.feature } });
    return { id: row.id };
  }

  // ---------------------------------------------------------------- lists
  async mine(user: any) {
    const me = await this.me(user);
    const rows = await this.manager.query(
      `select f.id, f.kind, f.title, f.module_title, f.feature, f.status, f.impact, f.reporter_unread, f.last_activity_on, f.created_on, f.resolved_on
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
    if (q.q && String(q.q).trim()) { args.push(`%${String(q.q).trim().slice(0, 60).replace(/[%_\\]/g, '\\$&')}%`); where.push(`(f.title ilike $${args.length} or f.details::text ilike $${args.length})`); }
    const rows = await this.manager.query(
      `select f.id, f.kind, f.title, f.module_id, f.module_title, f.feature, f.status, f.impact, f.awaiting_staff, f.last_activity_on, f.created_on,
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
      details: r.details, impact: r.impact, files: r.files || [], status: r.status, status_label: STATUS_LABEL[r.status as FeedbackStatus], resolution: r.resolution,
      resolved_on: r.resolved_on, duplicate_of: r.duplicate_of, created_on: r.created_on, last_activity_on: r.last_activity_on,
      reporter_name: r.reporter_name, assignee_name: r.assignee_name, assignee_user_id: r.assignee_user_id, awaiting_staff: r.awaiting_staff,
      context: me.manage ? r.context : undefined,
      notes,
      can: {
        reply: r.status !== 'CLOSED' || (me.manage && !reporter),
        close: reporter && canReporterClose(r.status),
        reopen: reporter && canReporterReopen(r.status),
        manage: me.manage && !reporter,
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
    return this.manager.transaction(async (em) => {
      const r = await this.load(me, id, em);
      if (this.isReporter(r, me)) throw new ForbiddenException('Someone else answers your own report.');
      let dup: number | null = null;
      if (status === 'DUPLICATE') {
        dup = Number(body.duplicate_of);
        if (dup === r.id) throw new BadRequestException('A report cannot repeat itself.');
        const [first] = await em.query(`select id from app_feedback where id = $1 and business_id = $2 and not archive`, [dup, r.business_id]);
        if (!first) throw new BadRequestException('There is no report with that number.');
      }
      const finished = FINISHED.includes(status);
      await em.query(
        `update app_feedback set status = $2, resolution = coalesce($3, resolution), duplicate_of = $4, resolved_on = case when $5 then now() else null end,
                resolved_by = case when $5 then $6::int else null end, awaiting_staff = false, reporter_unread = true, last_activity_on = now() where id = $1`,
        [r.id, status, resolution, dup, finished, me.id]);
      await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS',$2,$3)`, [r.id, `Status: ${STATUS_LABEL[status]}${dup ? ` (same as report ${dup})` : ''}`, me.id]);
      if (resolution) await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'REPLY',$2,$3)`, [r.id, resolution, me.id]);
      await this.audit.record({ userId: me.id, action: 'feedback.status', entityType: 'app_feedback', entityId: r.id, summary: `report ${r.id} set to ${STATUS_LABEL[status]}`, details: { status } });
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
    await this.manager.query(`update app_feedback set status = 'CLOSED', awaiting_staff = false, reporter_unread = false, resolved_on = coalesce(resolved_on, now()), last_activity_on = now() where id = $1`, [r.id]);
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
      await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'STATUS','Status: Reopened by the reporter',$2)`, [r.id, me.id]);
      await em.query(`insert into app_feedback_note (feedback_id, kind, body, created_by) values ($1,'REPLY',$2,$3)`, [r.id, message, me.id]);
      const f = flagsAfter('reporter');
      await em.query(`update app_feedback set status = 'IN_PROGRESS', resolved_on = null, resolved_by = null, awaiting_staff = $2, reporter_unread = $3, last_activity_on = now() where id = $1`, [r.id, f.awaiting_staff, f.reporter_unread]);
      return { id: r.id };
    });
  }
}
