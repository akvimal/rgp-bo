import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Put, Query, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { HrKpiEngine } from './hr-kpi-engine.service';

import { isOwnerRole } from 'src/core/roles';
import { isListedRater, mayRate, raterProfile } from './hr-kpi-raters';
const Needs = (resource: string, action: string) => SetMetadata('kpi.needs', [resource, action]);

@Injectable()
export class KpiPeopleGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector, @InjectEntityManager() private readonly manager: EntityManager) {}
  async canActivate(ctx: ExecutionContext) {
    const [resource, action] = this.reflector.get<string[]>('kpi.needs', ctx.getHandler()) || ['kpirate', 'rate'];
    const req = ctx.switchToHttp().getRequest();
    if (await this.permissions.can(req.user?.roleid, resource, action)) return true;
    // a person whose job role is named as a rater on a measure may open the rating screen even if their login role does not hold the permission
    if (resource === 'kpirate' && (await isListedRater(this.manager, req.user?.id))) return true;
    throw new ForbiddenException('You are not allowed to do that with KPI.');
  }
}

/**
 * KPI for people who are not HR: managers rate the manual measures of the staff of their stores (the Business Head, of
 * everyone), and every staff member sees their own finalised scores. No pay information is reachable from here.
 */
@ApiTags('KPI')
@Controller('kpi')
@ApiBearerAuth()
@UseGuards(AuthGuard, KpiPeopleGuard)
export class KpiPeopleController {
  constructor(private readonly engine: HrKpiEngine, @InjectEntityManager() private readonly manager: EntityManager) {}

  private async scope(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    const stores: number[] = s.map((x: any) => x.store_id);
    const all = isOwnerRole(r?.name);
    return { all, stores, covers: (e: any) => all || (e.store_ids || []).some((x: number) => stores.includes(x)) || (e.store_id && stores.includes(e.store_id)) };
  }

  @Get('rate') @Needs('kpirate', 'rate')
  async month(@Query('period') period: string, @User() u: any) {
    const sc = await this.scope(u);
    const prof = await raterProfile(this.manager, u.id);
    // a manager (or the owner) sees the whole sheet; a person who may rate only the measures that name their job role sees just those, with no scores
    const wide = prof.owner || prof.roleCan;
    const rows = await this.engine.draft(period, e => sc.covers(e));
    return rows.map(d => {
      const items = d.items.map((i: any) => ({ ...i, can_rate: i.source === 'MANUAL' && mayRate(prof, i.rater_positions) }));
      const mine = wide ? items : items.filter((i: any) => i.can_rate);
      return {
        employee_id: d.employee_id, name: d.name, designation: d.designation, self: d.user_id === u.id, items: mine, pending: wide ? d.pending : mine.filter((i: any) => i.rating === null).length,
        percent: wide ? (d.finalised ? d.review.percent : d.draft.percent) : null, finalised: d.finalised, locked: d.locked,
      };
    }).filter(r => wide || r.items.length);
  }

  @Put('rate') @Needs('kpirate', 'rate')
  async rate(@Body() b: any, @User() u: any) {
    const sc = await this.scope(u);
    return this.engine.rate(b, u, e => sc.covers(e));
  }

  @Get('mine') @Needs('mykpi', 'view')
  mine(@User() u: any) { return this.engine.mine(u); }
}
