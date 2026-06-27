import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface DbQueryTiming {
  durationMs: number;
  query: string;
}

export interface RequestTimingState {
  requestId: string;
  method: string;
  url: string;
  startedAtNs: bigint;
  dbTotalMs: number;
  dbQueryCount: number;
  slowestDbQuery?: DbQueryTiming;
}

@Injectable()
export class RequestTimingContext {
  private readonly storage = new AsyncLocalStorage<RequestTimingState>();

  isEnabled(): boolean {
    return process.env.REQUEST_TIMING_ENABLED === 'true';
  }

  createRequestId(): string {
    return randomUUID();
  }

  run<T>(state: RequestTimingState, callback: () => T): T {
    return this.storage.run(state, callback);
  }

  getStore(): RequestTimingState | undefined {
    return this.storage.getStore();
  }

  recordDbQuery(durationMs: number, query: string): void {
    const state = this.getStore();
    if (!state) {
      return;
    }

    state.dbTotalMs += durationMs;
    state.dbQueryCount += 1;

    if (!state.slowestDbQuery || durationMs > state.slowestDbQuery.durationMs) {
      state.slowestDbQuery = {
        durationMs,
        query: this.normalizeQuery(query),
      };
    }
  }

  private normalizeQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim().slice(0, 500);
  }
}
