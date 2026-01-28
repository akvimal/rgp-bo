import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Request Context Interceptor
 *
 * Captures request metadata (IP address, user agent) and stores them in the request object
 * for use in audit logging throughout the request lifecycle.
 *
 * Usage: Apply globally in app.module.ts or on specific controllers
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Capture client IP address
    // Try multiple sources as proxies/load balancers may modify headers
    request.clientIp =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown';

    // Capture user agent for additional context
    request.userAgent = request.headers['user-agent'] || 'unknown';

    // Continue with request processing
    return next.handle();
  }
}
