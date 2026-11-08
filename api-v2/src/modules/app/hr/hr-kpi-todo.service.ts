import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { TodoService } from '../todos/todo.service';
import { istDay } from '../todos/todo-rules';
import { HrKpiEngine } from './hr-kpi-engine.service';
import { kpiNotes } from './hr-kpi-pace';

const WEEKLY_TITLE = 'Check your KPI progress';
const RATING_TITLE = 'Give last month\'s KPI ratings';

/** Repeating to-dos that follow from the KPIs: a weekly look at your own KPI, and (for the Business Head) the monthly ratings only a manager can give. */
@Injectable()
export class HrKpiTodoService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly todos: TodoService, private readonly engine: HrKpiEngine) {}

  /** the next date (YYYY-MM-DD) that falls on a weekday (0 = Sunday), today included */
  private nextWeekday(weekday: number): string {
    const today = istDay(new Date());
    const dow = new Date(today + 'T00:00:00Z').getUTCDay();
    return new Date(Date.parse(today + 'T00:00:00Z') + ((weekday - dow + 7) % 7) * 86400000).toISOString().slice(0, 10);
  }

  private nextMonthDay(day: number): string {
    const today = istDay(new Date());
    const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - 1;
    const here = new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
    return here >= today ? here : new Date(Date.UTC(y, m + 1, day)).toISOString().slice(0, 10);
  }

  async generate(b: any, user: any) {
    const weekday = b?.weekday === undefined || b?.weekday === null || b?.weekday === '' ? 1 : Number(b.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new BadRequestException('Choose a day of the week.');
    const positionId = b?.position_id ? Number(b.position_id) : null;
    const period = istDay(new Date()).slice(0, 7);
    const rows = await this.engine.draft(period, (e: any) => !!e.user_id && (!positionId || e.position_id === positionId));
    const existing = await this.manager.query(`select assignee_user_id from todo_template where title = $1 and active and not archive`, [WEEKLY_TITLE]);
    const has = new Set<number>(existing.map((x: any) => Number(x.assignee_user_id)));
    let created = 0, already = 0, noKpi = 0, skipped = 0;
    for (const r of rows) {
      if (!r.items.length) { noKpi += 1; continue; }
      if (has.has(r.user_id)) { already += 1; continue; }
      try {
        await this.todos.create(user, {
          title: WEEKLY_TITLE, notes: kpiNotes(r.items), dueday: this.nextWeekday(weekday), duetime: '09:00', assigneeuserid: r.user_id, priority: 'normal',
          soondays: 0, escalatedays: 7, repeat: { repeat: 'WEEKLY', days: [weekday] },
        });
        created += 1;
      } catch (e) {
        // a login that is not one of this person's people (no store in common) is left out, and the rest go ahead
        if (e instanceof ForbiddenException) skipped += 1; else throw e;
      }
    }
    // the ratings a manager must give each month, for the person asking
    let rating = false;
    const [manual] = await this.manager.query(`select count(*)::int as n from hr_kpi_metric where active and source = 'MANUAL'`);
    const [mine] = await this.manager.query(`select 1 as x from todo_template where title = $1 and assignee_user_id = $2 and active and not archive`, [RATING_TITLE, user.id]);
    if (manual.n > 0 && !mine) {
      await this.todos.create(user, {
        title: RATING_TITLE, notes: 'Open Rate staff and give the ratings that only a manager can give, so payroll for the month can go ahead.', dueday: this.nextMonthDay(3), duetime: '10:00',
        assigneeuserid: user.id, priority: 'high', soondays: 1, escalatedays: 5, repeat: { repeat: 'MONTHLY', day: 3 },
      });
      rating = true;
    }
    return { created, already, no_kpi: noKpi, skipped, rating_todo: rating };
  }
}
