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
const Needs = (resource: string, action: string) => SetMetadata('kpi.needs', [resource, action]);

@Injectable()
export class KpiPeopleGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const [resource, action] = this.reflector.get<string[]>('kpi.needs', ctx.getHandler()) || ['kpirate', 'rate'];
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, resource, action))) throw new ForbiddenException('You are not allowed to do that with KPI.');
    return true;
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
    const rows = await this.engine.draft(period, e => sc.covers(e));
    return rows.map(d => ({
      employee_id: d.employee_id, name: d.name, designation: d.designation, self: d.user_id === u.id, items: d.items, pending: d.pending,
      percent: d.finalised ? d.review.percent : d.draft.percent, finalised: d.finalised, locked: d.locked,
    }));
  }

  @Put('rate') @Needs('kpirate', 'rate')
  async rate(@Body() b: any, @User() u: any) {
    const sc = await this.scope(u);
    return this.engine.rate(b, u, e => sc.covers(e));
  }

  @Get('mine') @Needs('mykpi', 'view')
  mine(@User() u: any) { return this.engine.mine(u); }
}
