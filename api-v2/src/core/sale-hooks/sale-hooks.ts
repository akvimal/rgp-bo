import { Global, Injectable, Module } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { ModulesService } from '../modules/modules.service';
import { ModuleKey } from '../modules/modules';

/**
 * The places a business pack can join in when a bill is made, without core knowing the pack exists.
 *
 *  - check:  runs before a bill is saved, and refuses it by throwing (a rule: "this bill needs the prescriber").
 *  - saved:  runs inside the bill's own transaction once its header and lines are saved, so what the pack writes (a register entry) stands or falls with the bill.
 *
 * A hook says which pack or module it belongs to; it only runs for a business that has that pack (by its business type) or has switched that module on.
 */
export interface SaleContext {
  manager: EntityManager;
  sale: any;                      // the bill as sent: its items, its customer, its props
  customer?: any;
  storeId: number | null;
  userId: number;
  actingUserId?: number | null;
}
export interface SavedSaleContext extends SaleContext { saved: any; items: any[]; }

export interface SaleHook {
  name: string;
  pack?: string;
  module?: ModuleKey;
  check?(ctx: SaleContext): Promise<void>;
  saved?(ctx: SavedSaleContext): Promise<void>;
}

@Injectable()
export class SaleHooks {
  private readonly hooks: SaleHook[] = [];

  constructor(private readonly modules: ModulesService, @InjectEntityManager() private readonly manager: EntityManager) {}

  /** a pack adds its hook once, when it starts */
  register(hook: SaleHook) {
    if (!this.hooks.some((h) => h.name === hook.name)) this.hooks.push(hook);
  }

  names(): string[] { return this.hooks.map((h) => h.name); }

  private async storeOf(storeId: number | null): Promise<number | null> {
    if (storeId) return storeId;
    const [s] = await this.manager.query(`select id from stores order by id limit 1`);
    return s?.id ?? null;
  }

  private async active(h: SaleHook, storeId: number | null): Promise<boolean> {
    if (!h.pack && !h.module) return true;
    const store = await this.storeOf(storeId);
    if (!store) return false;
    if (h.pack && !(await this.modules.packOnForStore(store, h.pack))) return false;
    if (h.module && !(await this.modules.onForStore(store, h.module))) return false;
    return true;
  }

  async check(ctx: SaleContext) {
    for (const h of this.hooks) if (h.check && (await this.active(h, ctx.storeId))) await h.check(ctx);
  }

  async saved(ctx: SavedSaleContext) {
    for (const h of this.hooks) if (h.saved && (await this.active(h, ctx.storeId))) await h.saved(ctx);
  }
}

@Global()
@Module({ providers: [SaleHooks], exports: [SaleHooks] })
export class SaleHooksModule {}
