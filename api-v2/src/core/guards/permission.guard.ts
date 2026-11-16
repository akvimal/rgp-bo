import { STOCK_PERMISSION_PREFIX, isStockAction } from 'src/modules/app/stock/stock-access';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorator/permission.decorator';
import { PermissionService } from 'src/modules/app/roles/permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());
    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request['user'];
    if (!user?.roleid) throw new ForbiddenException();

    const roleid = user.roleid;

    // the stock actions (stock/stock-access.ts): `stockDo:qty.adjust`
    if (permission.startsWith(STOCK_PERMISSION_PREFIX)) {
      const action = permission.slice(STOCK_PERMISSION_PREFIX.length);
      if (!isStockAction(action) || !(await this.permissionService.canDoStock(roleid, action))) throw new ForbiddenException(`Permission denied: ${action}`);
      return true;
    }

    switch (permission) {
      case 'viewCost':        await this.permissionService.assertCanViewCost(roleid); break;
      case 'managePricing':   await this.permissionService.assertCanManagePricing(roleid); break;
      case 'auditStock':      await this.permissionService.assertCanAuditStock(roleid); break;
      case 'manageBusinesses': await this.permissionService.assertCanManageBusinesses(roleid); break;
      case 'manageDeliveryPartners': if (!(await this.permissionService.canManageDeliveryPartners(roleid))) throw new ForbiddenException('Delivery partner access denied'); break;
      case 'useReports':      if (!(await this.permissionService.canUseReports(roleid))) throw new ForbiddenException('Reports access denied'); break;
      default: {
        const [resource, action] = permission.split(':');
        if (!resource || !action) throw new ForbiddenException(`Invalid permission key: ${permission}`);
        const allowed = await this.permissionService.can(roleid, resource, action);
        if (!allowed) throw new ForbiddenException(`Permission denied: ${permission}`);
      }
    }

    return true;
  }
}
