import * as jwt from 'jsonwebtoken';
import { ModuleSet } from './plans';

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'closed';

/** What a tenant's app is told it may do. Signed with that tenant's own secret, so a token cannot be used for another tenant. */
export interface Entitlements {
  slug: string;
  plan: string;
  planLabel: string;
  /** what the app should act on: a trial that has ended reads as suspended */
  status: TenantStatus;
  reason: string | null;
  trialEnds: string | null;
  /** a demonstration account: sample data, may be reset */
  demo: boolean;
  modules: ModuleSet;
  /** documents: files uploaded in all; scans: invoice copies and statements read in a month; null means no limit */
  limits: { stores: number; users: number; documents: number | null; scans: number | null };
}

export const TOKEN_DAYS = 30;

/** Allowances held on trials and demos, whatever the plan says: sample and trial accounts must not cost more than they bring in. */
export const CAPS = {
  demo: { documents: Number(process.env.DEMO_MAX_DOCUMENTS || 20), scans: Number(process.env.DEMO_MAX_SCANS || 10) },
  trial: { documents: Number(process.env.TRIAL_MAX_DOCUMENTS || 100), scans: Number(process.env.TRIAL_MAX_SCANS || 30) },
};

const smaller = (a: number | null, b: number): number => (a === null || a === undefined ? b : Math.min(a, b));

/**
 * The upload and scan allowance for a customer. A figure set on the customer itself wins (the admin chose it); otherwise the
 * plan's, held down to the demo or trial cap while the account is a demo or still in its trial. A paid plan with no figure is unlimited.
 */
export function documentLimits(t: { is_demo?: boolean; status: TenantStatus; max_documents?: number | null; max_scans?: number | null }, plan: { max_documents?: number | null; max_scans?: number | null }): { documents: number | null; scans: number | null } {
  const cap = t.is_demo ? CAPS.demo : (t.status === 'trial' ? CAPS.trial : null);
  const pick = (own: number | null | undefined, fromPlan: number | null | undefined, capped: number | undefined): number | null => {
    if (own !== null && own !== undefined) return own;
    const base = fromPlan ?? null;
    return cap && capped !== undefined ? smaller(base, capped) : base;
  };
  return { documents: pick(t.max_documents, plan.max_documents, cap?.documents), scans: pick(t.max_scans, plan.max_scans, cap?.scans) };
}

/** Trial days run out: the stored status stays "trial" but the app is told "suspended" (reason trial_ended). */
export function effectiveStatus(status: TenantStatus, trialEnds: string | null, today = new Date().toISOString().slice(0, 10)): { status: TenantStatus; reason: string | null } {
  if (status === 'trial' && trialEnds && trialEnds < today) return { status: 'suspended', reason: 'trial_ended' };
  if (status === 'suspended') return { status, reason: 'suspended' };
  if (status === 'closed') return { status, reason: 'closed' };
  return { status, reason: null };
}

export function sign(e: Entitlements, secret: string): string {
  return jwt.sign({ ...e, v: 1 }, secret, { algorithm: 'HS256', expiresIn: `${TOKEN_DAYS}d`, issuer: 'rgp-control-plane', subject: e.slug });
}

export function verify(token: string, secret: string): Entitlements {
  return jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'rgp-control-plane' }) as any as Entitlements;
}
