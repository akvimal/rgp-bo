/**
 * Rules for the Staff and Counter views: a person's day against their own usual, never against anyone else (DASHBOARD_AND_MENU_DESIGN 3.2).
 * Pure: relative imports only.
 */

/** the share of bills with a real mobile number, in whole percent; no bills means nothing to measure */
export const capturePct = (withMobile: number, bills: number): number | null => (bills > 0 ? Math.round((withMobile / bills) * 100) : null);

/** the average of the same day of the week over earlier weeks (the person's "usual"); null when there is no history */
export const usualOf = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** how far a figure is from the person's usual: amount and percent; null when there is no usual to compare with */
export function againstUsual(value: number, usual: number | null): { diff: number; pct: number | null } | null {
  if (usual === null) return null;
  return { diff: Math.round(value - usual), pct: usual > 0 ? Math.round(((value - usual) / usual) * 1000) / 10 : null };
}

export interface Goal { key: string; title: string; done: number; of: number; note: string }

/** today's goals: each is done/of; `pct` is capped at 100 and a goal with nothing to do counts as done */
export function goalProgress(g: Goal): { pct: number; complete: boolean } {
  if (g.of <= 0) return { pct: 100, complete: true };
  const pct = Math.min(100, Math.round((g.done / g.of) * 100));
  return { pct, complete: g.done >= g.of };
}

/** the headline ring: how much of the aim is reached today, capped at 100; no aim means no ring */
export const ringPct = (value: number, aim: number | null): number | null => (aim && aim > 0 ? Math.min(100, Math.round((value / aim) * 100)) : null);

/** the aim for today: the person's usual plus a stretch (default 10%); never below the usual */
export const aimFromUsual = (usual: number | null, stretchPct = 10): number | null => (usual === null ? null : Math.round(usual * (1 + Math.max(0, stretchPct) / 100)));
