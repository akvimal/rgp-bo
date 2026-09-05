/**
 * Minimal API client for the seed generator.
 * - No global ValidationPipe on the API, so bodies go through raw: send real
 *   number types, omit nulls you don't mean.
 * - Auth: POST /auth/login {email,password} -> {token}; Bearer on everything else.
 */
import 'dotenv/config';

const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public method: string, public path: string, public body: string) {
    super(`${method} ${path} -> ${status}: ${body.slice(0, 500)}`);
  }
}

const tokenCache = new Map<string, string>();

export async function login(email: string, password = process.env.QA_ADMIN_PASS || 'admin123'): Promise<string> {
  const key = `${email}:${password}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, 'POST', '/auth/login', text);
  const token = JSON.parse(text).token as string;
  tokenCache.set(key, token);
  return token;
}

export function clearTokenCache() {
  tokenCache.clear();
}

export interface ReqOpts {
  token?: string;
  as?: string; // email to login as (uses QA_ADMIN_PASS)
  query?: Record<string, string | number | boolean | undefined>;
  expect?: number[]; // acceptable status codes (default 2xx)
}

export async function api<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts: ReqOpts = {},
): Promise<T> {
  let token = opts.token;
  if (!token && opts.as) token = await login(opts.as);

  let url = `${API}${path}`;
  if (opts.query) {
    const qs = Object.entries(opts.query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const okCodes = opts.expect ?? [];
  const ok = res.ok || okCodes.includes(res.status);
  if (!ok) throw new ApiError(res.status, method, path, text);
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const GET = <T = any>(p: string, o?: ReqOpts) => api<T>('GET', p, undefined, o);
export const POST = <T = any>(p: string, b?: unknown, o?: ReqOpts) => api<T>('POST', p, b, o);
export const PUT = <T = any>(p: string, b?: unknown, o?: ReqOpts) => api<T>('PUT', p, b, o);
export const DEL = <T = any>(p: string, o?: ReqOpts) => api<T>('DELETE', p, undefined, o);

export { API };
