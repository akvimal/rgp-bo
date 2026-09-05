/**
 * Per-test performance + health capture. Attaches to every page:
 *  - console errors / warnings and uncaught page errors
 *  - every network request: method, url, status, wall time, and the API's
 *    own x-api-duration-ms / x-db-duration-ms / x-db-query-count headers
 *  - navigation + web-vitals-ish metrics pulled from the page at test end
 * Writes report/metrics/<safe-title>.json; the perf-reporter merges them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

export const METRICS_DIR = join(process.cwd(), 'report', 'metrics');

export interface RequestMetric {
  method: string; url: string; status: number;
  wallMs: number; apiMs?: number; dbMs?: number; dbQueries?: number;
}
export interface PageMetric {
  title: string;
  ok: boolean;
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  requests: RequestMetric[];
  slowestApi?: RequestMetric;
  totalApiMs: number;
  totalDbMs: number;
  apiCalls: number;
  nav?: { domContentLoaded?: number; load?: number; firstContentfulPaint?: number; jsHeapMB?: number };
}

const API_HOST = new URL(process.env.QA_API_URL || 'http://localhost:3000').host;

export function attachPerf(page: Page) {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const requests: RequestMetric[] = [];
  const started = new Map<string, number>();

  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error') consoleErrors.push(msg.text().slice(0, 500));
    else if (t === 'warning') consoleWarnings.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 500)));

  page.on('request', (req) => started.set(req.url() + req.method(), Date.now()));
  page.on('requestfinished', async (req) => {
    try {
      const url = req.url();
      // only app API + proxied /api calls
      const isApi = url.includes('/api/') || new URL(url).host === API_HOST;
      if (!isApi) return;
      const res = await req.response();
      if (!res) return;
      const h = res.headers();
      const t0 = started.get(url + req.method());
      requests.push({
        method: req.method(),
        url: new URL(url).pathname,
        status: res.status(),
        wallMs: t0 ? Date.now() - t0 : 0,
        apiMs: h['x-api-duration-ms'] ? Number(h['x-api-duration-ms']) : undefined,
        dbMs: h['x-db-duration-ms'] ? Number(h['x-db-duration-ms']) : undefined,
        dbQueries: h['x-db-query-count'] ? Number(h['x-db-query-count']) : undefined,
      });
    } catch { /* ignore */ }
  });

  return async function finalize(info: TestInfo): Promise<PageMetric> {
    let nav: PageMetric['nav'] = {};
    try {
      nav = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
        const mem = (performance as any).memory;
        return {
          domContentLoaded: n ? Math.round(n.domContentLoadedEventEnd) : undefined,
          load: n ? Math.round(n.loadEventEnd) : undefined,
          firstContentfulPaint: fcp ? Math.round(fcp.startTime) : undefined,
          jsHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : undefined,
        };
      });
    } catch { /* page may be closed */ }

    const apiReqs = requests.filter((r) => r.apiMs !== undefined);
    const slowestApi = apiReqs.slice().sort((a, b) => (b.apiMs || 0) - (a.apiMs || 0))[0];
    const metric: PageMetric = {
      title: info.title,
      ok: info.status === 'passed' || info.status === info.expectedStatus,
      consoleErrors, consoleWarnings, pageErrors, requests,
      slowestApi,
      totalApiMs: +apiReqs.reduce((a, r) => a + (r.apiMs || 0), 0).toFixed(1),
      totalDbMs: +apiReqs.reduce((a, r) => a + (r.dbMs || 0), 0).toFixed(1),
      apiCalls: apiReqs.length,
      nav,
    };

    try {
      mkdirSync(METRICS_DIR, { recursive: true });
      const safe = (info.titlePath.join('__') || info.title).replace(/[^\w.-]+/g, '_').slice(0, 150);
      writeFileSync(join(METRICS_DIR, `${safe}.json`), JSON.stringify(metric, null, 2));
    } catch { /* best effort */ }

    return metric;
  };
}
