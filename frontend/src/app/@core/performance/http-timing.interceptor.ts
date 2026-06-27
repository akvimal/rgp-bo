import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable()
export class HttpTimingInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!environment.requestTiming) {
      return next.handle(request);
    }

    const requestId = this.createRequestId();
    const startedAt = this.now();
    const timedRequest = request.clone({
      headers: request.headers.set('x-request-id', requestId),
    });

    return next.handle(timedRequest).pipe(
      tap((event: HttpEvent<unknown>) => {
        if (event instanceof HttpResponse) {
          this.logTiming(timedRequest, startedAt, event.status, event.headers);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.logTiming(timedRequest, startedAt, error.status, error.headers, true);
        return throwError(error);
      }),
    );
  }

  private logTiming(
    request: HttpRequest<unknown>,
    startedAt: number,
    status: number,
    headers: HttpResponse<unknown>['headers'],
    failed = false,
  ): void {
    const browserMs = this.now() - startedAt;
    const serverRequestId = headers?.get('x-request-id');
    const apiMs = headers?.get('x-api-duration-ms');
    const dbMs = headers?.get('x-db-duration-ms');
    const dbQueryCount = headers?.get('x-db-query-count');

    console.log('[HTTP timing]', {
      requestId: serverRequestId ?? request.headers.get('x-request-id'),
      method: request.method,
      url: request.urlWithParams,
      status,
      browserMs: Number(browserMs.toFixed(1)),
      apiMs: apiMs ? Number(apiMs) : undefined,
      dbMs: dbMs ? Number(dbMs) : undefined,
      dbQueryCount: dbQueryCount ? Number(dbQueryCount) : undefined,
      failed,
    });
  }

  private now(): number {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  private createRequestId(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const values = new Uint32Array(4);
      crypto.getRandomValues(values);
      return Array.from(values)
        .map((value) => value.toString(16).padStart(8, '0'))
        .join('');
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
