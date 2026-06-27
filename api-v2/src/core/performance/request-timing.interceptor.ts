import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  RequestTimingContext,
  RequestTimingState,
} from './request-timing.context';

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimingInterceptor.name);

  constructor(private readonly timingContext: RequestTimingContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.timingContext.isEnabled() || context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId =
      this.getHeaderValue(request.headers['x-request-id']) ??
      this.timingContext.createRequestId();

    const state: RequestTimingState = {
      requestId,
      method: request.method,
      url: request.originalUrl ?? request.url,
      startedAtNs: process.hrtime.bigint(),
      dbTotalMs: 0,
      dbQueryCount: 0,
    };

    response.setHeader('x-request-id', requestId);

    let recorded = false;
    const record = (error?: unknown) => {
      if (recorded) {
        return;
      }
      recorded = true;

      const totalMs = this.elapsedMs(state.startedAtNs);
      if (!response.headersSent) {
        response.setHeader(
          'server-timing',
          `api;dur=${totalMs.toFixed(1)}, db;dur=${state.dbTotalMs.toFixed(1)}`,
        );
        response.setHeader('x-api-duration-ms', totalMs.toFixed(1));
        response.setHeader('x-db-duration-ms', state.dbTotalMs.toFixed(1));
        response.setHeader('x-db-query-count', String(state.dbQueryCount));
      }

      if (this.shouldLog(totalMs)) {
        const logPayload = {
          requestId: state.requestId,
          method: state.method,
          url: state.url,
          statusCode: response.statusCode,
          apiMs: Number(totalMs.toFixed(1)),
          dbMs: Number(state.dbTotalMs.toFixed(1)),
          dbQueryCount: state.dbQueryCount,
          slowestDbQuery: state.slowestDbQuery,
          failed: Boolean(error),
        };

        if (error) {
          this.logger.warn(JSON.stringify(logPayload));
        } else {
          this.logger.log(JSON.stringify(logPayload));
        }
      }
    };

    return this.timingContext.run(state, () =>
      next.handle().pipe(
        tap(() => record()),
        catchError((error: unknown) => {
          record(error);
          return throwError(() => error);
        }),
      ),
    );
  }

  private elapsedMs(startedAtNs: bigint): number {
    return Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
  }

  private shouldLog(totalMs: number): boolean {
    const minMs = Number(process.env.REQUEST_TIMING_LOG_MIN_MS ?? '0');
    return Number.isFinite(minMs) ? totalMs >= minMs : true;
  }

  private getHeaderValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
}
