import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

export interface AuditEventInput {
  userId?: number | null;
  actingUserId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  summary?: string | null;
  details?: Record<string, any> | null;
  status?: number | null;
  ip?: string | null;
}

/** Writes to the append-only audit_event table. Never throws: auditing must not break the business action. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async record(e: AuditEventInput): Promise<void> {
    try {
      await this.manager.query(
        `insert into audit_event (user_id, acting_user_id, action, entity_type, entity_id, summary, details, status, ip)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          e.userId ?? null,
          e.actingUserId ?? null,
          e.action,
          e.entityType ?? null,
          e.entityId == null ? null : String(e.entityId),
          e.summary ?? null,
          e.details ? JSON.stringify(e.details) : null,
          e.status ?? null,
          e.ip ?? null,
        ],
      );
    } catch (err) {
      this.logger.error(`audit write failed for ${e.action}: ${err?.message}`);
    }
  }

  async search(q: { from?: string; to?: string; userid?: number; action?: string; entitytype?: string; entityid?: string; limit?: number; offset?: number }) {
    const where: string[] = [];
    const args: any[] = [];
    const add = (sql: string, v: any) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
    if (q.from) add(`a.occurred_on >= ?::date`, q.from);
    if (q.to) add(`a.occurred_on < (?::date + 1)`, q.to);
    if (q.userid) {
      args.push(q.userid);
      where.push(`(a.user_id = $${args.length} or a.acting_user_id = $${args.length})`);
    }
    if (q.action) add(`a.action like ?`, `${q.action}%`);
    if (q.entitytype) add(`a.entity_type = ?`, q.entitytype);
    if (q.entityid) add(`a.entity_id = ?`, q.entityid);
    const w = where.length ? `where ${where.join(' and ')}` : '';
    const limit = Math.min(Math.max(q.limit || 50, 1), 500);
    const offset = Math.max(q.offset || 0, 0);
    const [{ count }] = await this.manager.query(`select count(*)::int as count from audit_event a ${w}`, args);
    const rows = await this.manager.query(
      `select a.id, a.occurred_on, a.user_id, u.full_name as user_name, a.acting_user_id, au.full_name as acting_user_name,
              a.action, a.entity_type, a.entity_id, a.summary, a.details, a.status, a.ip
         from audit_event a
         left join app_user u on u.id = a.user_id
         left join app_user au on au.id = a.acting_user_id
         ${w}
        order by a.occurred_on desc, a.id desc
        limit ${limit} offset ${offset}`,
      args,
    );
    return { total: count, rows };
  }
}
