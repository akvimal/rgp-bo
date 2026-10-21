import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from './permission.service';

/** Overrides the `purchases` action a controller needs for a change (default: add for POST, edit for PUT/PATCH, delete for DELETE). */
export const PurchasingWriteAction = (action: string) => SetMetadata('purchasing.writeAction', action);

/** Also lets a role holding one of these `purchases` actions through on this handler (Sales Staff `request` creates a purchase request). */
export const PurchasingAlsoAllow = (...actions: string[]) => SetMetadata('purchasing.alsoAllow', actions);

// POSTs that only read (a filtered list, a document download)
const READ_ONLY_POSTS = [/\/filter$/, /\/download\/po$/];

/**
 * The purchasing API was open to any signed-in user; the menu merely hid the buttons. This makes the `purchases`
 * permission real: reading needs `read`, changing needs `add` / `edit` / `delete` (or the controller's own action).
 * Runs after AuthGuard, which puts the token payload on the request.
 */
@Injectable()
export class PurchasingGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || req.url || '').split('?')[0];
    const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method) || (method === 'POST' && READ_ONLY_POSTS.some((r) => r.test(path)));

    let action = 'read';
    if (!readOnly) {
      action = this.reflector.getAllAndOverride<string>('purchasing.writeAction', [context.getHandler(), context.getClass()])
        || (method === 'DELETE' ? 'delete' : method === 'POST' ? 'add' : 'edit');
    }
    const also = this.reflector.get<string[]>('purchasing.alsoAllow', context.getHandler()) || [];
    const allowed = readOnly ? [action] : [action, ...also];
    let ok = false;
    for (const a of allowed) if (!ok && (await this.permissions.can(req.user?.roleid, 'purchases', a))) ok = true;
    if (!ok) {
      throw new ForbiddenException(readOnly ? 'You are not allowed to view purchasing data.' : 'You are not allowed to change purchasing data.');
    }
    return true;
  }
}
