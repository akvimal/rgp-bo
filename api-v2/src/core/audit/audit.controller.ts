import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { AuditService } from './audit.service';

// Business-level oversight: the business owner only. Site Admin is a platform role with no business data.
const ALLOWED_ROLES = ['Business Head'];

@ApiTags('Audit')
@Controller('audit')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    @InjectEntityManager() private readonly manager: EntityManager,
  ) {}

  @Get()
  async search(@Query() q: any, @User() user: any) {
    await this.assertAllowed(user);
    return this.audit.search({
      from: q.from, to: q.to, action: q.action, entitytype: q.entitytype, entityid: q.entityid,
      userid: q.userid ? +q.userid : undefined,
      limit: q.limit ? +q.limit : undefined,
      offset: q.offset ? +q.offset : undefined,
    });
  }

  /** People who appear in the log, for the filter dropdown. */
  @Get('users')
  async users(@User() user: any) {
    await this.assertAllowed(user);
    return this.manager.query(
      `select u.id, u.full_name as name from app_user u
        where u.id in (select user_id from audit_event where user_id is not null union select acting_user_id from audit_event where acting_user_id is not null)
        order by u.full_name`);
  }

  private async assertAllowed(user: any) {
    const row = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!ALLOWED_ROLES.includes(row?.[0]?.name)) {
      throw new ForbiddenException('Not authorized to view the audit log.');
    }
  }
}
