import { BadRequestException, Controller, Delete, ForbiddenException, Get, Global, Injectable, Module, Param, Put, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { AuthModule } from 'src/modules/auth/auth.module';
import { User } from 'src/core/decorator/user.decorator';
import { AuditService } from 'src/core/audit/audit.service';
import { PlatformService } from 'src/core/platform/platform.service';
import { BUSINESS_OF_USER_SQL, businessOfUser } from '../business-of-user';
import { isOwnerRole } from '../roles';
import { packsOf } from '../modules/modules';
import { asValues, checkScope, checkValue, CONFIG_SCOPES, ConfigItem, ConfigRow, ConfigScope, defOf, resolveConfig } from './config-schema';

/** today in the store's time zone (India), as yyyy-mm-dd, offset by days */
const dayIST = (offset = 0) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const MAX_AHEAD_DAYS = 90;

interface Ctx { businessId: number; owner: boolean; businessType: string; packs: string[]; userId: number }

@Injectable()
export class ConfigService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly platform: PlatformService,
  ) {}

  private async context(user: any): Promise<Ctx> {
    const businessId = await businessOfUser(this.manager, user?.id || 0);
    if (!businessId) throw new ForbiddenException('Your user is not linked to a business.');
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const [b] = await this.manager.query(`select business_type from business where id = $1`, [businessId]);
    const businessType = b?.business_type ?? 'pharmacy';
    return { businessId, owner: isOwnerRole(role?.name), businessType, packs: packsOf(businessType), userId: user.id };
  }

  private async rows(businessId: number, scope?: string): Promise<ConfigRow[]> {
    return this.manager.query(
      `select scope, key, value, to_char(effective_from, 'YYYY-MM-DD') as effective_from from config_override
        where business_id = $1 ${scope ? 'and scope = $2' : ''}`,
      scope ? [businessId, scope] : [businessId],
    );
  }

  private items(c: Ctx, rows: ConfigRow[], scope?: ConfigScope, today = dayIST()): ConfigItem[] {
    return resolveConfig({ scope, rows, today, businessType: c.businessType, packs: c.packs, planLocked: this.platform.entitlements()?.configLocked });
  }

  /** What applies to the signed-in user's business today. Anyone signed in may read it (the views and rules depend on it). */
  async effective(user: any, scope?: string) {
    if (scope && !CONFIG_SCOPES.includes(scope as ConfigScope)) throw new BadRequestException('Unknown settings group.');
    const c = await this.context(user);
    const items = this.items(c, await this.rows(c.businessId, scope), scope as ConfigScope | undefined);
    return { canEdit: c.owner, businessType: c.businessType, items };
  }

  /** The values a server rule needs, e.g. the escalation days: { key: value } for one scope. */
  async valuesFor(businessId: number, scope: ConfigScope): Promise<Record<string, any>> {
    const [b] = await this.manager.query(`select business_type from business where id = $1`, [businessId]);
    const type = b?.business_type ?? 'pharmacy';
    return asValues(resolveConfig({ scope, rows: await this.rows(businessId, scope), today: dayIST(), businessType: type, packs: packsOf(type) }));
  }

  /** The Business Head's choices for a group, from a date (tomorrow unless said). Everything is checked before anything is written. */
  async save(user: any, scope: string, body: any) {
    if (!CONFIG_SCOPES.includes(scope as ConfigScope)) throw new BadRequestException('Unknown settings group.');
    const c = await this.context(user);
    if (!c.owner) throw new ForbiddenException('Only the Business Head can change these settings.');
    const values = body?.values;
    if (!values || typeof values !== 'object' || !Object.keys(values).length) throw new BadRequestException('Nothing to change.');
    const from = body?.effectiveFrom ? String(body.effectiveFrom) : dayIST(1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < dayIST() || from > dayIST(MAX_AHEAD_DAYS)) {
      throw new BadRequestException(`The start date must be between today and ${MAX_AHEAD_DAYS} days ahead.`);
    }
    const rows = await this.rows(c.businessId, scope);
    const before = this.items(c, rows, scope as ConfigScope);
    const next: Record<string, any> = asValues(before);
    for (const [key, v] of Object.entries(values)) {
      const d = defOf(scope, key);
      const item = before.find((x) => x.key === key);
      if (!d || !item) throw new BadRequestException(`Unknown setting "${key}".`);
      if (item.planLocked) throw new ForbiddenException(`"${d.label}" is not changeable on your plan.`);
      const err = checkValue(d, v);
      if (err) throw new BadRequestException(err);
      next[key] = v;
    }
    const scopeErr = checkScope(scope as ConfigScope, next);
    if (scopeErr) throw new BadRequestException(scopeErr);

    const changed = Object.entries(values).filter(([k, v]) => before.find((x) => x.key === k)?.value !== v);
    await this.manager.transaction(async (m) => {
      for (const [key, v] of Object.entries(values)) {
        await m.query(
          `insert into config_override (business_id, scope, key, value, effective_from, created_by) values ($1,$2,$3,$4::jsonb,$5::date,$6)
           on conflict (business_id, scope, key, effective_from) do update set value = excluded.value, created_by = excluded.created_by, created_on = now()`,
          [c.businessId, scope, key, JSON.stringify(v), from, c.userId],
        );
      }
    });
    await this.audit.record({
      userId: c.userId, action: 'config.save', entityType: 'config', entityId: scope,
      summary: `Changed ${changed.length} setting(s) in ${scope}, from ${from}`,
      details: { from, changes: changed.map(([k, v]) => ({ key: k, before: before.find((x) => x.key === k)?.value, after: v })) },
    });
    return { ok: true, effectiveFrom: from, changed: changed.length };
  }

  /** Who changed what in this business, newest first: settings saved and reset, and sales targets. A group can be asked for on its own. */
  async history(user: any, scope?: string) {
    if (scope && !CONFIG_SCOPES.includes(scope as ConfigScope)) throw new BadRequestException('Unknown settings group.');
    const c = await this.context(user);
    const rows = await this.manager.query(
      `select a.id, to_char(a.occurred_on at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as at, u.full_name as who, a.action, a.entity_id, a.summary, a.details
         from audit_event a join app_user u on u.id = a.user_id
        where (a.action like 'config.%' or a.action = 'dashboard.target') and ${BUSINESS_OF_USER_SQL} = $1
          and ($2::text is null or a.action = 'dashboard.target' and $2 = 'health' or a.entity_id = $2 or a.entity_id like $2 || '.%')
        order by a.occurred_on desc, a.id desc limit 50`,
      [c.businessId, scope || null]);
    return rows;
  }

  /** Back to the default for one setting or a whole group (the business's own rows are removed). */
  async reset(user: any, scope: string, key?: string) {
    if (!CONFIG_SCOPES.includes(scope as ConfigScope)) throw new BadRequestException('Unknown settings group.');
    const c = await this.context(user);
    if (!c.owner) throw new ForbiddenException('Only the Business Head can change these settings.');
    if (key) {
      const item = this.items(c, [], scope as ConfigScope).find((x) => x.key === key);
      if (!item) throw new BadRequestException(`Unknown setting "${key}".`);
      if (item.planLocked) throw new ForbiddenException(`"${item.label}" is not changeable on your plan.`);
    }
    const r = await this.manager.query(
      `delete from config_override where business_id = $1 and scope = $2 ${key ? 'and key = $3' : ''} returning key`,
      key ? [c.businessId, scope, key] : [c.businessId, scope],
    );
    const n = Array.isArray(r) ? (Array.isArray(r[0]) ? r[0].length : r.length) : 0;
    await this.audit.record({ userId: c.userId, action: 'config.reset', entityType: 'config', entityId: key ? `${scope}.${key}` : scope, summary: `Reset ${key ? key : scope} to the default`, details: { removed: n } });
    return { ok: true, removed: n };
  }
}

@ApiTags('Config')
@Controller('config')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ConfigController {
  constructor(private readonly service: ConfigService) {}

  @Get('history') history(@Query('scope') scope: string, @User() u: any) { return this.service.history(u, scope); }
  @Get() effective(@Query('scope') scope: string, @User() u: any) { return this.service.effective(u, scope); }
  @Put(':scope') save(@Param('scope') scope: string, @Body() body: any, @User() u: any) { return this.service.save(u, scope, body); }
  @Delete(':scope') resetScope(@Param('scope') scope: string, @User() u: any) { return this.service.reset(u, scope); }
  @Delete(':scope/:key') resetKey(@Param('scope') scope: string, @Param('key') key: string, @User() u: any) { return this.service.reset(u, scope, key); }
}

/** Global so the register, recognition and dashboard services can read their settings. */
@Global()
@Module({ imports: [AuthModule], controllers: [ConfigController], providers: [ConfigService], exports: [ConfigService] })
export class BusinessConfigModule {}
