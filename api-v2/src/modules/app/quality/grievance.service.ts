import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AddNoteDto, CreateGrievanceDto, UpdateGrievanceDto } from './dto/grievance.dto';

/** Who is asking and which stores they may see (null = every store). */
export interface GrievanceScope { userId: number; role: string; storeIds: number[] | null }

const DUE_DAYS: Record<string, number> = { HIGH: 1, MEDIUM: 3, LOW: 7 };
// from -> allowed next statuses
const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

@Injectable()
export class GrievanceService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async scopeFor(user: any): Promise<GrievanceScope> {
    const r = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const role = r?.[0]?.name;
    if (role === 'Business Head') return { userId: user.id, role, storeIds: null };
    if (role === 'Store Head') {
      const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
      return { userId: user.id, role, storeIds: s.map((x: any) => x.store_id) };
    }
    throw new ForbiddenException('Not authorized for grievances.');
  }

  /**
   * Who may work the refill list: the Business Head (every store), the Store Head and the counter staff (their own
   * stores). Grievances stay with the first two; this is separate so the counter cannot reach them.
   */
  async refillScopeFor(user: any): Promise<GrievanceScope> {
    const r = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const role = r?.[0]?.name;
    if (role === 'Business Head') return { userId: user.id, role, storeIds: null };
    if (role === 'Store Head' || role === 'Sales Staff') {
      const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
      return { userId: user.id, role, storeIds: s.map((x: any) => x.store_id) };
    }
    throw new ForbiddenException('Not authorized for refills.');
  }

  private inScope(sc: GrievanceScope, storeId: number) {
    return sc.storeIds === null || sc.storeIds.includes(storeId);
  }

  async list(sc: GrievanceScope, q: { status?: string; category?: string; severity?: string; storeid?: number; overdue?: boolean; q?: string; aboutuserid?: number }) {
    const where: string[] = [`($1::int[] is null or g.store_id = any($1::int[]))`];
    const args: any[] = [sc.storeIds];
    const add = (sql: string, v: any) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
    if (q.status === 'ACTIVE') where.push(`g.status in ('OPEN','IN_PROGRESS')`);
    else if (q.status) add(`g.status = ?`, q.status);
    if (q.category) add(`g.category = ?`, q.category);
    if (q.severity) add(`g.severity = ?`, q.severity);
    if (q.storeid) add(`g.store_id = ?`, q.storeid);
    if (q.aboutuserid) add(`g.about_user_id = ?`, q.aboutuserid);
    if (q.overdue) where.push(`g.status in ('OPEN','IN_PROGRESS') and g.due_on < current_date`);
    if (q.q) {
      args.push(`%${q.q}%`);
      const p = `$${args.length}`;
      where.push(`(g.summary ilike ${p} or c.name ilike ${p} or c.mobile ilike ${p} or ('G-' || lpad(g.id::text, 5, '0')) ilike ${p})`);
    }
    return this.manager.query(
      `${this.selectSql()}
        where ${where.join(' and ')}
        order by (g.status in ('OPEN','IN_PROGRESS')) desc,
                 case g.severity when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end,
                 g.due_on, g.id desc
        limit 500`,
      args,
    );
  }

  private selectSql() {
    return `select g.id, 'G-' || lpad(g.id::text, 5, '0') as ticket, g.store_id, st.location as store, g.customer_id, c.name as customer_name, c.mobile as customer_mobile,
                   g.sale_id, s.bill_no, s.bill_date, g.about_user_id, ab.full_name as about_name, g.category, g.severity, g.source,
                   g.summary, g.description, g.status, g.assigned_to, asg.full_name as assigned_name, g.due_on, g.resolution, g.resolved_on,
                   g.created_on, g.created_by, cr.full_name as created_name,
                   (g.status in ('OPEN','IN_PROGRESS') and g.due_on < current_date) as overdue,
                   (current_date - g.created_on::date) as age_days
              from grievance g
              join stores st on st.id = g.store_id
              left join customer c on c.id = g.customer_id
              left join sale s on s.id = g.sale_id
              left join app_user ab on ab.id = g.about_user_id
              left join app_user asg on asg.id = g.assigned_to
              left join app_user cr on cr.id = g.created_by`;
  }

  async summary(sc: GrievanceScope) {
    const [row] = await this.manager.query(
      `select count(*) filter (where status = 'OPEN')::int as open,
              count(*) filter (where status = 'IN_PROGRESS')::int as in_progress,
              count(*) filter (where status in ('OPEN','IN_PROGRESS') and due_on < current_date)::int as overdue,
              count(*) filter (where status in ('OPEN','IN_PROGRESS') and severity = 'HIGH')::int as high_open,
              count(*) filter (where status in ('RESOLVED','CLOSED') and resolved_on >= now() - interval '30 days')::int as resolved_30d,
              round(avg(extract(epoch from (resolved_on - created_on)) / 86400)
                    filter (where resolved_on >= now() - interval '90 days')::numeric, 1) as avg_days_to_resolve
         from grievance where ($1::int[] is null or store_id = any($1::int[]))`,
      [sc.storeIds],
    );
    const staff = await this.manager.query(
      `select g.about_user_id as userid, u.full_name as name, count(*)::int as complaints,
              count(*) filter (where g.status in ('OPEN','IN_PROGRESS'))::int as open
         from grievance g join app_user u on u.id = g.about_user_id
        where g.about_user_id is not null and g.created_on >= now() - interval '90 days'
          and ($1::int[] is null or g.store_id = any($1::int[]))
        group by 1, 2 order by complaints desc limit 5`,
      [sc.storeIds],
    );
    return { ...row, staff };
  }

  async get(sc: GrievanceScope, id: number) {
    const [g] = await this.manager.query(`${this.selectSql()} where g.id = $1`, [id]);
    if (!g || !this.inScope(sc, g.store_id)) throw new NotFoundException('Grievance not found.');
    const notes = await this.manager.query(
      `select n.id, n.kind, n.note, n.created_on, u.full_name as author
         from grievance_note n join app_user u on u.id = n.created_by
        where n.grievance_id = $1 order by n.created_on, n.id`, [id]);
    return { ...g, notes };
  }

  async create(sc: GrievanceScope, dto: CreateGrievanceDto) {
    const storeId = dto.storeid ?? (await this.primaryStore(sc.userId));
    if (!storeId || !this.inScope(sc, storeId)) throw new ForbiddenException('That store is not available to you.');
    const severity = dto.severity || 'MEDIUM';
    return this.manager.transaction(async tx => {
      if (dto.saleid) {
        const [s] = await tx.query(`select store_id from sale where id = $1`, [dto.saleid]);
        if (!s) throw new BadRequestException('Bill not found.');
        if (s.store_id && s.store_id !== storeId) throw new BadRequestException('That bill belongs to a different store.');
      }
      const [row] = await tx.query(
        `insert into grievance (store_id, customer_id, sale_id, about_user_id, assigned_to, category, severity, source, summary, description, due_on, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, current_date + $11::int, $12, $12) returning id`,
        [storeId, dto.customerid ?? null, dto.saleid ?? null, dto.aboutuserid ?? null, dto.assignedto ?? null, dto.category, severity,
         dto.source || 'COUNTER', dto.summary.trim(), dto.description?.trim() || null, DUE_DAYS[severity], sc.userId],
      );
      await tx.query(`insert into grievance_note (grievance_id, kind, note, created_by) values ($1,'STATUS','Logged',$2)`, [row.id, sc.userId]);
      return { id: row.id };
    });
  }

  async update(sc: GrievanceScope, id: number, dto: UpdateGrievanceDto) {
    const cur = await this.get(sc, id);
    const notes: Array<[string, string]> = [];
    const sets: string[] = [];
    const args: any[] = [];
    const set = (col: string, v: any) => { args.push(v); sets.push(`${col} = $${args.length}`); };

    if (dto.status && dto.status !== cur.status) {
      if (!TRANSITIONS[cur.status].includes(dto.status)) throw new BadRequestException(`Cannot move from ${cur.status} to ${dto.status}.`);
      if (dto.status === 'CLOSED' && sc.role !== 'Business Head') throw new ForbiddenException('Only the Business Head can close a grievance.');
      if (cur.status === 'CLOSED' && sc.role !== 'Business Head') throw new ForbiddenException('Only the Business Head can reopen a closed grievance.');
      set('status', dto.status);
      if (dto.status === 'RESOLVED') {
        const resolution = (dto.resolution || '').trim();
        if (resolution.length < 5) throw new BadRequestException('Describe how it was resolved.');
        set('resolution', resolution); set('resolved_on', new Date()); set('resolved_by', sc.userId);
        notes.push(['STATUS', `Resolved: ${resolution}`]);
      } else if (dto.status === 'OPEN' && ['RESOLVED', 'CLOSED'].includes(cur.status)) {
        sets.push('resolution = null', 'resolved_on = null', 'resolved_by = null');
        notes.push(['STATUS', 'Reopened']);
      } else {
        notes.push(['STATUS', dto.status === 'IN_PROGRESS' ? 'In progress' : dto.status === 'CLOSED' ? 'Closed' : 'Moved back to open']);
      }
    } else if (dto.resolution !== undefined && cur.status !== 'RESOLVED') {
      throw new BadRequestException('A resolution can only be recorded when resolving.');
    }
    if (dto.assignedto !== undefined && dto.assignedto !== cur.assigned_to) {
      const [u] = await this.manager.query(`select full_name from app_user where id = $1 and active and not archive`, [dto.assignedto]);
      if (!u) throw new BadRequestException('Assignee not found.');
      set('assigned_to', dto.assignedto);
      notes.push(['ASSIGN', `Assigned to ${u.full_name}`]);
    }
    if (dto.severity && dto.severity !== cur.severity) {
      set('severity', dto.severity);
      notes.push(['STATUS', `Severity ${cur.severity.toLowerCase()} to ${dto.severity.toLowerCase()}`]);
    }
    if (!sets.length) return this.get(sc, id);
    set('updated_on', new Date()); set('updated_by', sc.userId);
    args.push(id);
    await this.manager.transaction(async tx => {
      await tx.query(`update grievance set ${sets.join(', ')} where id = $${args.length}`, args);
      for (const [kind, note] of notes) {
        await tx.query(`insert into grievance_note (grievance_id, kind, note, created_by) values ($1,$2,$3,$4)`, [id, kind, note, sc.userId]);
      }
    });
    return this.get(sc, id);
  }

  async addNote(sc: GrievanceScope, id: number, dto: AddNoteDto) {
    await this.get(sc, id);
    await this.manager.query(`insert into grievance_note (grievance_id, kind, note, created_by) values ($1,'NOTE',$2,$3)`, [id, dto.note.trim(), sc.userId]);
    await this.manager.query(`update grievance set updated_on = now(), updated_by = $2 where id = $1`, [id, sc.userId]);
    return this.get(sc, id);
  }

  /** Staff a complaint can be about or assigned to: everyone for the Business Head, own-store colleagues for a Store Head. */
  people(sc: GrievanceScope) {
    return this.manager.query(
      `select distinct u.id, u.full_name as name, r.name as role
         from app_user u join app_role r on r.id = u.role_id
         left join user_stores us on us.user_id = u.id and us.active and not us.archive
        where u.active and not u.archive and r.name in ('Store Head','Sales Staff','Business Head')
          and ($1::int[] is null or us.store_id = any($1::int[]))
        order by u.full_name`, [sc.storeIds]);
  }

  stores(sc: GrievanceScope) {
    return this.manager.query(`select id, location from stores where active and not archive and ($1::int[] is null or id = any($1::int[])) order by location`, [sc.storeIds]);
  }

  customers(sc: GrievanceScope, q: string) {
    const t = (q || '').trim();
    if (t.length < 3) return [];
    return this.manager.query(
      `select id, name, mobile from customer where active and not archive and (name ilike $1 or mobile ilike $1) order by name limit 10`, [`%${t}%`]);
  }

  bills(sc: GrievanceScope, billno: number) {
    return this.manager.query(
      `select s.id, s.bill_no, s.bill_date, s.total, s.store_id, c.name as customer_name, s.customer_id
         from sale s left join customer c on c.id = s.customer_id
        where s.bill_no = $1 and s.status = 'COMPLETE' and s.bill_date >= now() - interval '400 days'
          and ($2::int[] is null or s.store_id = any($2::int[]))
        order by s.bill_date desc limit 10`, [billno, sc.storeIds]);
  }

  private async primaryStore(userId: number): Promise<number | null> {
    const [r] = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive order by is_primary desc limit 1`, [userId]);
    return r?.store_id ?? null;
  }
}
