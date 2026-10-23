import { createHmac, timingSafeEqual } from 'crypto';
import { ModuleState, PurchasingLevel } from '../modules/modules';

/** What the control plane tells this customer's app it may do (control-plane/src/entitlements.ts is the sender). */
export interface Entitlements {
  slug: string;
  plan: string;
  planLabel: string;
  /** a trial that has ended already arrives as suspended */
  status: 'trial' | 'active' | 'suspended' | 'closed';
  reason: string | null;
  trialEnds: string | null;
  /** a demonstration account: sample data that may be reset */
  demo?: boolean;
  modules: ModuleState;
  /** documents: files uploaded in all; scans: invoice copies and statements read per month. Empty means no limit. */
  limits: { stores: number; users: number; documents?: number | null; scans?: number | null };
}

const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Checks an HS256 token signed with this customer's secret and returns what it says, or null when it is not genuine. An expired
 * token is still returned (`expired: true`): losing touch with the control plane must not stop a pharmacy trading.
 */
export function verifyEntitlements(token: string, secret: string, slug: string): (Entitlements & { expired: boolean }) | null {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(b64(h).toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const want = createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const got = b64(s);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const body = JSON.parse(b64(p).toString('utf8'));
    if (body.iss !== 'rgp-control-plane' || body.slug !== slug) return null;
    return { ...(body as Entitlements), expired: typeof body.exp === 'number' && body.exp * 1000 < Date.now() };
  } catch {
    return null;
  }
}

const LEVEL: Record<PurchasingLevel, number> = { off: 0, simple: 1, full: 2 };

/** The owner's own choices, held inside what the plan allows. */
export function clampModules(chosen: ModuleState, allowed: ModuleState): ModuleState {
  const purchasing: PurchasingLevel = LEVEL[chosen.purchasing] <= LEVEL[allowed.purchasing] ? chosen.purchasing : allowed.purchasing;
  return {
    hr: chosen.hr && allowed.hr,
    purchasing,
    gst: chosen.gst && allowed.gst && purchasing !== 'off',
    expenses: chosen.expenses && allowed.expenses,
    payment_recon: chosen.payment_recon && allowed.payment_recon,
    stock_audits: chosen.stock_audits && allowed.stock_audits,
    transfers: chosen.transfers && allowed.transfers,
  };
}

/** The modules the plan does not include, by key. */
export function lockedModules(allowed: ModuleState): string[] {
  const out: string[] = [];
  for (const k of ['hr', 'gst', 'expenses', 'payment_recon', 'stock_audits', 'transfers'] as const) if (!allowed[k]) out.push(k);
  if (allowed.purchasing !== 'full') out.push('purchasing');
  return out;
}
