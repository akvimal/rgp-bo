import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { permsOf, grants } from 'src/core/role-rules';
import { CustomerAction, canDoCustomers } from './customers-access';

/**
 * The action on the `customers` permission a route needs (docs/planning/MENU_AND_PERMISSIONS.md, step E, Customers). `orTill` also lets a role
 * through that works the till (holds `sales` add or bill): the credit check at billing reads a customer's limit and balance.
 */
export const NeedsCustomers = (action: CustomerAction, opts: { orTill?: boolean } = {}) => SetMetadata('customers.needs', { action, orTill: !!opts.orTill });

export const META_KEY = 'customers.needs';

/** whether a role works the till: it can add or bill a sale */
export const worksTheTill = (perms: any[]): boolean => grants(perms, 'sales', 'add') || grants(perms, 'sales', 'bill');

@Injectable()
export class CustomerActionGuard implements CanActivate {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const need = this.reflector.get<{ action: CustomerAction; orTill: boolean }>(META_KEY, context.getHandler());
    if (!need) return true;
    const req = context.switchToHttp().getRequest();
    const [role] = await this.manager.query(`select name, permissions from app_role where id = $1`, [req.user?.roleid || 0]);
    const perms = permsOf(role);
    if (role && (canDoCustomers(role.name, perms, need.action) || (need.orTill && worksTheTill(perms)))) return true;
    throw new ForbiddenException('This is not open to your role.');
  }
}
