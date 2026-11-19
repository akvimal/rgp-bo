import { Perm, grants } from 'src/core/role-rules';
import { addDays } from './insights-rules';

/**
 * The figures on the Reports hub cards. Each card that carries figures names the actions that open it, the same ones the menu entry for that page
 * uses (see frontend `reports-hub.ts`), so a person is never shown a figure from a page they may not open. Pure, so the rules are tested without a database.
 */
export const TILE_NEEDS: Record<string, string[]> = {
  'rh-ask': ['reports.ask'],
  'rh-weekly': ['reports.margin'],
  'rh-stock': ['store.read'],
  'rh-audits': ['stockaudit.view'],
  'rh-drug-register': ['scheduleregister.view'],
  'rh-payables': ['purchases.add'],
  'rh-vendor-returns': ['purchases.returns.manage'],
  'rh-gst-recon': ['purchases.add', 'gstfiling.view'],
  'rh-financials': ['finance.view', 'expenses.approve'],
  'rh-finance': ['finance.view'],
  'rh-gst': ['gstfiling.view'],
  'rh-discrepancies': ['discrepancies.view'],
  'rh-review': ['review.view'],
  'rh-compliance': ['compliance.view'],
  'rh-audit': ['audit.view'],
  'rh-audiences': ['customers.audiences.use'],
  'rh-sale-list': ['sales'],
  'rh-returns': ['sales'],
  'rh-staff-sales': ['staffsales.view'],
  'rh-refills': ['refills.view'],
  'rh-followups': ['customers.read', 'refills.view'],
  'rh-dues': ['customers.dues.view'],
  'rh-complaints': ['grievances.view'],
  'rh-expiry': ['store.read'],
  'rh-invoices': ['purchases.add'],
  'rh-expenses': ['expenses.view'],
  'rh-digital': ['paymentrecon.view'],
  'rh-cashbook': ['store.shift.open', 'store.shift.close', 'store.adjust'],
};

/** whether the permissions hold one key: "resource" is any grant on that resource, "resource.action" one action (the action may itself hold dots) */
export function holds(perms: Perm[], key: string): boolean {
  const dot = key.indexOf('.');
  if (dot < 0) return perms.some((p) => p.resource === key);
  return grants(perms, key.slice(0, dot), key.slice(dot + 1));
}

/** whether this login may see the figures of a card: an owner role always, anyone else by any one of the card's actions */
export function mayOpenTile(owner: boolean, perms: Perm[], id: string): boolean {
  const needs = TILE_NEEDS[id];
  if (!needs) return false;
  return owner || needs.some((k) => holds(perms, k));
}

/** the stretch of the same length just before a period (`from` to the day after the last, as in periodRange), to compare with */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
  return { from: addDays(from, -days), to: from };
}

export interface Figure { key: string; label: string; kind: 'money' | 'number' | 'percent' | 'text'; value: number | string | null; prev?: number | null; trend?: boolean }

/** put the figures of the earlier period beside the ones of this: only the figures that ask for a trend, and only numbers */
export function withPrevious(now: Figure[], before: Figure[]): Figure[] {
  const prev = new Map(before.map((f) => [f.key, f.value]));
  return now.map((f) => {
    const b = prev.get(f.key);
    return f.trend && typeof f.value === 'number' && typeof b === 'number' ? { ...f, prev: b } : f;
  });
}
