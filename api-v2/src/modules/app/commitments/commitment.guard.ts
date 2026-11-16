import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { permsOf } from 'src/core/role-rules';
import { canUseCustomerOrders } from './commitment-access';

/** An endpoint any signed-in user may call (purchasing asks who is waiting for a product); it was never limited to the till. */
export const OpenToSignedIn = () => SetMetadata('customerorders.open', true);

/** Customer orders need the `customerorders` permission (view or manage). Runs after AuthGuard, which puts the token payload on the request. */
@Injectable()
export class CustomerOrdersGuard implements CanActivate {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>('customerorders.open', context.getHandler())) return true;
    const req = context.switchToHttp().getRequest();
    const [role] = await this.manager.query(`select name, permissions from app_role where id = $1`, [req.user?.roleid || 0]);
    if (!role || !canUseCustomerOrders(role.name, permsOf(role))) throw new ForbiddenException('Customer orders are not open to your role.');
    return true;
  }
}
