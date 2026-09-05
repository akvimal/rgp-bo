import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { primeContext, apiLogin, landingPath, openAs, type Me, type SignInOpts } from './auth.js';
import { attachPerf, type PageMetric } from './perf.js';
import { data } from './data.js';

const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

export interface AppHarness {
  /** open an authenticated page for a persona (perf-instrumented) */
  open(email: string, to?: string, opts?: SignInOpts): Promise<{ page: Page; me: Me }>;
  /** a real UI login on a fresh page (for AUTH-1..3); returns the page after submit */
  loginUI(email: string, password?: string): Promise<Page>;
  /** current persona's /auth/me */
  me(email: string): Promise<Me>;
}

export interface ApiHarness {
  token(email: string): Promise<string>;
  request(method: string, path: string, body?: unknown, email?: string): Promise<{ status: number; body: any }>;
  raw(email?: string): Promise<{ headers: Record<string, string>; get: (p: string) => Promise<Response> }>;
}

interface Fixtures {
  app: AppHarness;
  api: ApiHarness;
}

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    await use(context);
  },

  app: async ({ context }, use, testInfo) => {
    const finalizers: Array<() => Promise<PageMetric>> = [];

    const harness: AppHarness = {
      async open(email, to, opts) {
        const { token, me } = await primeContext(context, email, opts ?? {});
        const page = await context.newPage();
        const fin = attachPerf(page);
        finalizers.push(() => fin(testInfo));
        await page.goto(to ?? landingPath(me), { waitUntil: 'domcontentloaded' });
        return { page, me };
      },
      async loginUI(email, password = PASS) {
        const page = await context.newPage();
        const fin = attachPerf(page);
        finalizers.push(() => fin(testInfo));
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.getByTestId('login-email').fill(email);
        await page.getByTestId('login-password').fill(password);
        await page.getByTestId('login-submit').click();
        return page;
      },
      async me(email) {
        return (await apiLogin(email)).me;
      },
    };

    await use(harness);

    // write per-test perf metrics + a compact summary attachment
    const metrics = await Promise.all(finalizers.map((f) => f().catch(() => null)));
    const merged = metrics.filter(Boolean) as PageMetric[];
    if (merged.length) {
      const consoleErrors = merged.flatMap((m) => m.consoleErrors);
      const pageErrors = merged.flatMap((m) => m.pageErrors);
      const apiCalls = merged.reduce((a, m) => a + m.apiCalls, 0);
      const totalApiMs = +merged.reduce((a, m) => a + m.totalApiMs, 0).toFixed(1);
      const slow = merged.map((m) => m.slowestApi).filter(Boolean).sort((a, b) => (b!.apiMs || 0) - (a!.apiMs || 0))[0];
      testInfo.attach('perf-summary.json', {
        body: JSON.stringify({ apiCalls, totalApiMs, slowestApi: slow, consoleErrors, pageErrors }, null, 2),
        contentType: 'application/json',
      });
    }
  },

  api: async ({}, use) => {
    const DEFAULT = 'businesshead@local.test';
    const tokens = new Map<string, string>();
    const token = async (email = DEFAULT) => {
      if (!tokens.has(email)) tokens.set(email, (await apiLogin(email)).token);
      return tokens.get(email)!;
    };
    const harness: ApiHarness = {
      token,
      async request(method, path, body, email = 'businesshead@local.test') {
        const t = await token(email);
        const res = await fetch(`${API}${path}`, {
          method,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let parsed: any = text;
        try { parsed = JSON.parse(text); } catch { /* keep text */ }
        return { status: res.status, body: parsed };
      },
      async raw(email = 'businesshead@local.test') {
        const t = await token(email);
        return {
          headers: { authorization: `Bearer ${t}` },
          get: (p: string) => fetch(`${API}${p}`, { headers: { authorization: `Bearer ${t}` } }),
        };
      },
    };
    await use(harness);
  },
});

export { expect, data, landingPath, openAs, apiLogin };
export type { Page, BrowserContext, Me };
