import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// login / password change write their own, richer events
const SKIP_PREFIXES = ['/auth/', '/audit'];

/**
 * Records every successful or rejected write request against the signed-in user. Request bodies are
 * deliberately not stored (they carry passwords and customer details); the action, route, target id
 * and result are enough to answer "who did what, when". Richer events (sale edits, ...) are recorded
 * explicitly by the services that know the before/after.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    if (!MUTATING.has(req.method)) return next.handle();
    const path: string = (req.originalUrl || req.url || '').split('?')[0].replace(/^\/api/, '');
    if (SKIP_PREFIXES.some(p => path.startsWith(p))) return next.handle();

    const write = (status: number, body?: any) => {
      const segments = path.split('/').filter(Boolean);
      const idFromPath = segments.find(s => /^\d+$/.test(s));
      this.audit.record({
        userId: req.user?.id ?? null,
        action: `http.${req.method.toLowerCase()}`,
        entityType: segments[0] ?? null,
        entityId: req.params?.id ?? idFromPath ?? body?.id ?? null,
        summary: `${req.method} ${path}`,
        status,
        ip: req.ip,
      });
    };
    return next.handle().pipe(
      tap({
        next: body => write(res.statusCode, body),
        error: err => write(err?.status ?? err?.getStatus?.() ?? 500),
      }),
    );
  }
}
