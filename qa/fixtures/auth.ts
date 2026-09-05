/**
 * Auth injection. The app keeps its JWT in sessionStorage['token'] and the
 * permission tree in sessionStorage['permissions'] - neither is covered by
 * Playwright storageState, so we log in via the API and seed both with an
 * init script that runs before the app boots.
 */
import type { BrowserContext, Page } from '@playwright/test';

const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

export interface Me {
  id: number;
  fullname: string;
  rolename: string;
  businessid: number | null;
  businessname?: string;
  permissions: any[];
}

const cache = new Map<string, { token: string; me: Me }>();

export async function apiLogin(email: string, password = PASS): Promise<{ token: string; me: Me }> {
  const hit = cache.get(email);
  if (hit) return hit;
  const lr = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!lr.ok) throw new Error(`login ${email} -> ${lr.status} ${await lr.text()}`);
  const token = (await lr.json()).token as string;
  const mr = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  if (!mr.ok) throw new Error(`/auth/me ${email} -> ${mr.status}`);
  const me = (await mr.json()) as Me;
  const rec = { token, me };
  cache.set(email, rec);
  return rec;
}

export interface SignInOpts {
  storeId?: number | null;          // localStorage selected_store_id  (null = "All stores")
  operatorId?: number;              // localStorage selected_operator_id (sales staff selector)
  operatorName?: string;
}

/** seed sessionStorage/localStorage on a context so every page loads authenticated */
export async function primeContext(ctx: BrowserContext, email: string, opts: SignInOpts = {}) {
  const { token, me } = await apiLogin(email);
  await ctx.addInitScript(
    ({ token, permissions, storeId, operatorId, operatorName }) => {
      try {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('permissions', JSON.stringify(permissions));
        if (storeId !== undefined) {
          if (storeId === null) localStorage.removeItem('selected_store_id');
          else localStorage.setItem('selected_store_id', String(storeId));
        }
        if (operatorId !== undefined) {
          localStorage.setItem('selected_operator_id', String(operatorId));
          if (operatorName) localStorage.setItem('selected_operator_name', operatorName);
        }
      } catch { /* storage unavailable */ }
    },
    { token, permissions: me.permissions, storeId: opts.storeId, operatorId: opts.operatorId, operatorName: opts.operatorName },
  );
  return { token, me };
}

/** landing path the app would pick after a real login (first path of first permission) */
export function landingPath(me: Me): string {
  const p0 = me.permissions?.[0]?.path;
  const path = Array.isArray(p0) ? p0[0] : p0;
  return path || '/secure/dashboard';
}

/** open an authenticated page for a persona, already navigated to `to` (default: landing) */
export async function openAs(
  ctx: BrowserContext,
  email: string,
  to?: string,
  opts: SignInOpts = {},
): Promise<{ page: Page; me: Me; token: string }> {
  const { token, me } = await primeContext(ctx, email, opts);
  const page = await ctx.newPage();
  await page.goto(to ?? landingPath(me));
  return { page, me, token };
}
