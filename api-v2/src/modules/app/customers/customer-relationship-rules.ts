/**
 * Who a customer is to the business, worked out from their bills (never stored, so it is always current).
 *
 * Each customer with a bill in the last year is scored 1-5 on recency, frequency and spend against the other customers (quintiles of the
 * business's own base, so it fits a small shop and a large one). The scores and the buying rhythm then give one segment:
 *   No purchases | Lapsed | New | At risk | Champions | Loyal | Big spenders | Regular
 * "Due back" is not a segment but a flag: a customer with a steady rhythm who is now past their usual gap.
 */
export const SEGMENTS = ['Champions', 'Loyal', 'Big spenders', 'Regular', 'New', 'At risk', 'Lapsed', 'No purchases'] as const;
export type Segment = (typeof SEGMENTS)[number];
export type Tier = 'Gold' | 'Silver' | 'Bronze' | null;

export const NEW_DAYS = 90;             // a first bill this recent makes a customer "new"...
export const NEW_MAX_VISITS = 3;        // ...until they have this many visits
export const NO_RHYTHM_RISK_DAYS = 120; // with no steady rhythm, this long without a visit is "at risk"

/** One row per customer as the database returns it. Days are whole days up to today. */
export interface CustomerFacts {
  id: number;
  visitsAll: number;
  visits12: number;
  spend12: number;
  daysSinceLast: number | null;
  daysSinceFirst: number | null;
  daysSinceCreated: number;
  usualGap: number | null;   // median days between visits (gaps under a week ignored); null without a steady rhythm
  credit: number;            // store credit the customer still holds
}

export interface Profile {
  status: 'active' | 'inactive';
  segment: Segment;
  tier: Tier;
  r: number | null;
  f: number | null;
  m: number | null;
  dueBack: boolean;
  usualGap: number | null;
  reason: string;
}

/** 1-5 by the share of the base this value beats (ties share a score). */
export function quintile(value: number, all: number[], higherBetter = true): number {
  if (!all.length) return 3;
  const worse = all.filter((v) => (higherBetter ? v < value : v > value)).length;
  return Math.min(5, 1 + Math.floor((5 * worse) / all.length));
}

/** A steady rhythm needs three visits and a usual gap between a week and five months. */
export function hasRhythm(f: CustomerFacts): boolean {
  return f.visitsAll >= 3 && f.usualGap !== null && f.usualGap >= 7 && f.usualGap <= 150;
}

/** How late a customer with a rhythm can be before they stop being "due back" and become "at risk". */
export function dueLimit(gap: number): number {
  return Math.max(Math.round(gap * 1.5), gap + 14);
}

const rupees = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function classify(rows: CustomerFacts[], activeDays: number): Map<number, Profile> {
  const scored = rows.filter((r) => r.visits12 > 0);
  const recency = scored.map((r) => r.daysSinceLast ?? 0);
  const freq = scored.map((r) => r.visits12);
  const spend = scored.map((r) => r.spend12);
  const out = new Map<number, Profile>();

  for (const c of rows) {
    const has = c.visitsAll > 0 && c.daysSinceLast !== null;
    const lapsed = has && (c.daysSinceLast as number) > activeDays;
    // a customer who still holds store credit is never called inactive: they have a reason to come back
    const status: Profile['status'] =
      lapsed && c.credit <= 0 ? 'inactive'
      : !has && c.daysSinceCreated > activeDays && c.credit <= 0 ? 'inactive'
      : 'active';

    const p: Profile = { status, segment: 'Regular', tier: null, r: null, f: null, m: null, dueBack: false, usualGap: c.usualGap, reason: '' };
    out.set(c.id, p);

    if (!has) { p.segment = 'No purchases'; p.reason = 'No bills yet'; continue; }
    const days = c.daysSinceLast as number;
    const ago = `last seen ${plural(days, 'day')} ago`;

    if (c.visits12 > 0) {
      p.r = quintile(days, recency, false);
      p.f = quintile(c.visits12, freq);
      p.m = quintile(c.spend12, spend);
      const avg = (p.r + p.f + p.m) / 3;
      p.tier = avg >= 4 ? 'Gold' : avg >= 3 ? 'Silver' : 'Bronze';
    }

    const rhythm = hasRhythm(c);
    const gap = c.usualGap as number;
    if (rhythm && !lapsed && days >= gap && days <= dueLimit(gap)) p.dueBack = true;
    const atRisk = !lapsed && c.visitsAll >= 3 && (rhythm ? days > dueLimit(gap) : days > NO_RHYTHM_RISK_DAYS);
    // still "new" only while they have had a visit or two; after that their buying speaks for itself
    const isNew = (c.daysSinceFirst ?? 9999) <= NEW_DAYS && c.visitsAll < NEW_MAX_VISITS;

    if (lapsed) {
      p.segment = 'Lapsed';
      p.reason = `${plural(c.visitsAll, 'visit')} in all, ${ago}`;
    } else if (isNew) {
      p.segment = 'New';
      p.reason = c.visitsAll === 1 ? `First bill ${plural(c.daysSinceFirst as number, 'day')} ago, no second visit yet` : `New: ${c.visitsAll} visits so far`;
    } else if (atRisk) {
      p.segment = 'At risk';
      p.reason = rhythm ? `Usually buys every ${Math.round(gap)} days, ${ago}` : `${plural(c.visitsAll, 'visit')} in all, ${ago}`;
    } else if ((p.r as number) >= 4 && (p.f as number) >= 4 && (p.m as number) >= 4) {
      p.segment = 'Champions';
      p.reason = `${plural(c.visits12, 'visit')} and ${rupees(c.spend12)} in the last year, ${ago}`;
    } else if ((p.f as number) >= 4 && (p.r as number) >= 3) {
      p.segment = 'Loyal';
      p.reason = `${plural(c.visits12, 'visit')} in the last year, ${ago}`;
    } else if ((p.m as number) >= 4) {
      p.segment = 'Big spenders';
      p.reason = `${rupees(c.spend12)} in the last year over ${plural(c.visits12, 'visit')}`;
    } else {
      p.segment = 'Regular';
      p.reason = `${plural(c.visits12, 'visit')} in the last year, ${ago}`;
    }
    if (p.dueBack) p.reason = `Usually buys every ${Math.round(gap)} days, ${ago}: due back`;
  }
  return out;
}

export interface AudienceDef {
  key: string;
  label: string;
  help: string;
  /** promotional audiences need the customer's consent; the others only need that they have not said no */
  promo: boolean;
  match: (p: Profile, f: CustomerFacts) => boolean;
}

export const AUDIENCES: AudienceDef[] = [
  { key: 'due_back', label: 'Due back', promo: false, match: (p) => p.dueBack,
    help: 'Regular buyers now past their usual gap: a refill or "we are here" reminder.' },
  { key: 'new_second_visit', label: 'New: second visit', promo: false,
    match: (p, f) => p.segment === 'New' && f.visitsAll === 1 && (f.daysSinceFirst ?? 0) >= 7 && (f.daysSinceFirst ?? 0) <= 60,
    help: 'One bill, 7 to 60 days ago. A welcome message that brings them back is what makes a regular.' },
  { key: 'champions', label: 'Champions', promo: true, match: (p) => p.segment === 'Champions',
    help: 'Your best customers: thank them, give early access. No discounts: they would buy anyway.' },
  { key: 'loyal', label: 'Loyal', promo: true, match: (p) => p.segment === 'Loyal',
    help: 'Frequent, recent buyers.' },
  { key: 'big_spenders', label: 'Big spenders, few visits', promo: true, match: (p) => p.segment === 'Big spenders',
    help: 'High bills but rare visits: invite them to bring their regular purchases to you.' },
  { key: 'at_risk', label: 'At risk', promo: true, match: (p) => p.segment === 'At risk',
    help: 'Used to visit often, now slipping: a personal call or message.' },
  { key: 'lapsed', label: 'Lapsed', promo: true, match: (p) => p.segment === 'Lapsed',
    help: 'Past the active period: a win-back offer, best past spenders first.' },
  { key: 'all_active', label: 'All active customers', promo: true, match: (p) => p.status === 'active' && p.segment !== 'No purchases',
    help: 'Everyone with a bill in the active period, for a general announcement.' },
];

/**
 * One message per number: people who share a mobile are one household, so a list to contact shows them once (the first, so the list's own order decides who:
 * best spender first) and says who else is on the number. People with no number are never merged.
 */
export function collapseByNumber<T extends { mobile: string | null; name: string | null }>(items: T[]): (T & { alsoOnNumber: string[] })[] {
  const first = new Map<string, T & { alsoOnNumber: string[] }>();
  const out: (T & { alsoOnNumber: string[] })[] = [];
  for (const it of items) {
    const key = it.mobile ? String(it.mobile) : '';
    const seen = key ? first.get(key) : undefined;
    if (seen) { seen.alsoOnNumber.push(String(it.name || '').trim() || '(no name)'); continue; }
    const row = { ...it, alsoOnNumber: [] as string[] };
    if (key) first.set(key, row);
    out.push(row);
  }
  return out;
}

/** Who may be contacted for an audience: never a stop-contact customer or one who said no; promotional ones also need a yes. */
export function contactable(c: { mobile: string | null; doNotContact: boolean; consent: string | null }, promo: boolean): { ok: boolean; why: string } {
  if (!c.mobile || !/^[6-9][0-9]{9}$/.test(c.mobile)) return { ok: false, why: 'No mobile number' };
  if (c.doNotContact) return { ok: false, why: 'Asked not to be contacted' };
  if (c.consent === 'NO') return { ok: false, why: 'Declined messages' };
  if (promo && c.consent !== 'YES') return { ok: false, why: 'Consent not recorded' };
  return { ok: true, why: '' };
}
