import { BadRequestException, CallHandler, ExecutionContext, ForbiddenException, Global, Injectable, Module, NestInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Observable } from 'rxjs';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { PlatformService } from 'src/core/platform/platform.service';
import { clampModules, lockedModules } from 'src/core/platform/entitlements';
import { ALL_ON, MODULE_KEYS, MODULE_LABELS, ModuleState, blockedBy, gatedPath, parseModulesInput, resolveModules } from './modules';

const TTL_MS = 15000;

/** What each business has switched on. Cached briefly: the answer is needed on every gated request. */
@Injectable()
export class ModulesService {
  private byBusiness = new Map<number, { at: number; state: ModuleState; raw: any }>();
  private businessOfUser = new Map<number, { at: number; businessId: number | null }>();

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly platform: PlatformService) {}

  private async businessFor(userId: number): Promise<number | null> {
    const hit = this.businessOfUser.get(userId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.businessId;
    const businessId = await businessOfUser(this.manager, userId);
    this.businessOfUser.set(userId, { at: Date.now(), businessId });
    return businessId;
  }

  async forBusiness(businessId: number | null): Promise<ModuleState> {
    return (await this.entry(businessId)).state;
  }

  private async entry(businessId: number | null) {
    if (!businessId) return { at: Date.now(), state: ALL_ON, raw: {} };
    const hit = this.byBusiness.get(businessId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit;
    const [b] = await this.manager.query(`select modules from business where id = $1`, [businessId]);
    // a hosted customer's plan caps what the owner can switch on
    const owned = resolveModules(b?.modules);
    const plan = this.platform.entitlements();
    const fresh = { at: Date.now(), state: plan ? clampModules(owned, plan.modules) : owned, raw: b?.modules || {} };
    this.byBusiness.set(businessId, fresh);
    return fresh;
  }

  /** the modules the customer's plan does not include (empty when standalone) */
  lockedByPlan(): string[] {
    const plan = this.platform.entitlements();
    return plan ? lockedModules(plan.modules) : [];
  }

  /** a user with no business (the platform admin) is not gated */
  async forUser(userId: number): Promise<ModuleState> {
    return this.forBusiness(await this.businessFor(userId));
  }

  /** a module is on for the business that owns this store */
  async onForStore(storeId: number, key: keyof ModuleState): Promise<boolean> {
    const [s] = await this.manager.query(`select business_id from stores where id = $1`, [storeId]);
    const m = await this.forBusiness(s?.business_id ?? null);
    return key === 'purchasing' ? m.purchasing !== 'off' : !!m[key];
  }

  /** The Business Head's switches, merged over what is stored; audited with before and after. */
  async update(businessId: number, userId: number, body: any) {
    const { value, error } = parseModulesInput(body);
    if (error) throw new BadRequestException(error);
    if (!Object.keys(value).length) throw new BadRequestException('Nothing to change.');
    const cur = await this.entry(businessId);
    const before = cur.state;
    const next = { ...cur.raw, ...value };
    if (value.gst === true && resolveModules(next).purchasing === 'off') throw new BadRequestException('GST reconciliation needs purchasing: switch purchasing on first.');
    await this.manager.query(`update business set modules = $2::jsonb where id = $1`, [businessId, JSON.stringify(next)]);
    this.byBusiness.delete(businessId);
    const after = await this.forBusiness(businessId);
    const changed = MODULE_KEYS.filter((k) => before[k] !== after[k]);
    if (changed.length) {
      await this.audit.record({
        userId, action: 'business.modules_updated', entityType: 'businesses', entityId: businessId,
        summary: `modules changed: ${changed.map((k) => `${MODULE_LABELS[k]} ${before[k]} -> ${after[k]}`).join(', ')}`,
        details: { before, after },
      });
    }
    return after;
  }
}

/** A switched-off module's endpoints answer 403, whatever the role (OPERATING_MODES section 7). */
@Injectable()
export class ModuleGateInterceptor implements NestInterceptor {
  constructor(private readonly modules: ModulesService, private readonly platform: PlatformService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const path: string = String(req?.path || req?.url || '').split('?')[0];
    // a suspended or closed account stops trading; signing in (and the message about why) still works
    const stopped = this.platform.blockedReason();
    if (stopped && !/^\/(auth|health)(\/|$)/.test(path)) throw new ForbiddenException(stopped);
    if (req?.user?.id && gatedPath(path)) {
      const reason = blockedBy(path, await this.modules.forUser(req.user.id));
      if (reason) throw new ForbiddenException(reason);
    }
    return next.handle();
  }
}

@Global()
@Module({
  providers: [ModulesService, { provide: APP_INTERCEPTOR, useClass: ModuleGateInterceptor }],
  exports: [ModulesService],
})
export class ModulesModule {}
