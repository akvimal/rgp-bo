/**
 * Fewer AI requests: when an answer may be kept, when it may be asked for again, and how often. Pure, so tested without a database.
 * See docs/planning/AI_CACHE.md.
 */
import { createHash } from 'crypto';

export type CacheKind = 'HIT' | 'MISS' | 'REFRESH' | 'REFUSED';

export interface AiPolicy {
  /** how long an answer is kept, in hours */
  ttlHours: number;
  /** asking again for the same facts: how many times in how many hours, counted per scope; null = no refresh button */
  refresh: { max: number; perHours: number } | null;
  /** may it be asked again when nothing it was based on has changed (the wording might differ), or is that refused */
  refreshWhenUnchanged: boolean;
  /** a cap on new requests (a first request or a refresh) per person */
  calls: { max: number; perHours: number } | null;
}

/** the defaults are guesses: set them from the usage log (Settings > AI assistant) once there is real use */
export const POLICIES: Record<string, AiPolicy> = {
  write_buying_brief: { ttlHours: 72, refresh: { max: 2, perHours: 24 }, refreshWhenUnchanged: false, calls: null },
  answer_question: { ttlHours: 24, refresh: null, refreshWhenUnchanged: false, calls: { max: 20, perHours: 1 } },
  write_coaching_note: { ttlHours: 24 * 35, refresh: { max: 3, perHours: 24 * 30 }, refreshWhenUnchanged: true, calls: null },
  write_weekly_summary: { ttlHours: 24 * 8, refresh: { max: 1, perHours: 24 }, refreshWhenUnchanged: true, calls: null },
};
export const policyOf = (feature: string): AiPolicy | null => POLICIES[feature] ?? null;

/** the setting ai.cache_mode: only an explicit "off" switches the cache and its limits off; anything else (or nothing) is on */
export const cacheOn = (value: unknown): boolean => String(value ?? 'on').trim().toLowerCase() !== 'off';

const HOUR = 3600000;
const toMs = (d: Date | string | number) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

/** JSON with the keys in order, so the same facts always give the same text */
export const stable = (v: any): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v === undefined ? null : v);
};

/** the fingerprint of what an answer is based on */
/** the facts as plain JSON (a value that is undefined is left out, as it is when read back from the database), so the same facts always match */
const canon = (v: any): any => { const j = JSON.stringify(v ?? null); return j === undefined ? null : JSON.parse(j); };
export const fingerprint = (parts: any): string => createHash('sha256').update(stable(canon(parts))).digest('hex');

/** a question with case, spacing and end punctuation ignored, so "Sales last week?" and "sales  last week" are one */
export const normaliseQuestion = (q: string): string => String(q ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[\s.?!,;:]+$/g, '').trim();

const set = (xs: any[]): string[] => [...new Set(xs.map((x) => String(x ?? '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean))].sort();

/**
 * What a buying brief is based on: the products on the reorder list and the products at risk of expiring (not the quantities or the days left, which drift
 * every day), and the newest verified purchase line at the stores in scope. A new purchase, or a new product on either list, is a new brief.
 */
export const briefFingerprint = (reorderTitles: string[], riskProducts: string[], purchaseMarker: string): string =>
  fingerprint({ kind: 'brief', reorder: set(reorderTitles), risk: set(riskProducts), purchase: purchaseMarker });

/** a question: the same words, on the same day (so "last week" means the same week), for the same kind of reader (an owner sees more reports) */
export const questionFingerprint = (question: string, today: string, owner: boolean): string =>
  fingerprint({ kind: 'ask', q: normaliseQuestion(question), day: today, owner });

export interface DecideInput {
  /** the kept answer for this fingerprint, if any (already within its lifetime) */
  entry: { createdOn: Date | string } | null;
  now: Date;
  /** the person asked to refresh (ask again) */
  refresh: boolean;
  policy: AiPolicy;
  /** when refreshes were made in this scope within the refresh window, and when this person made new requests within the calls window */
  refreshTimes: (Date | string)[];
  callTimes: (Date | string)[];
}
export type Decision =
  | { action: 'serve' }
  | { action: 'call'; kind: 'MISS' | 'REFRESH' }
  | { action: 'refuse'; reason: 'unchanged' | 'refresh_limit' | 'call_limit'; nextAllowedAt: Date | null };

/** when the oldest of the events in a window falls out of it, so one more is allowed */
const frees = (times: (Date | string)[], perHours: number): Date | null =>
  times.length ? new Date(Math.min(...times.map(toMs)) + perHours * HOUR) : null;

/** keep the answer, ask the model, or refuse */
export const decide = (i: DecideInput): Decision => {
  const { entry, now, refresh, policy } = i;
  const since = (h: number) => now.getTime() - h * HOUR;
  if (entry && !refresh) return { action: 'serve' };
  // a person's cap on new requests applies to a first request and to a refresh alike
  if (policy.calls) {
    const recent = i.callTimes.filter((t) => toMs(t) > since(policy.calls!.perHours));
    if (recent.length >= policy.calls.max) return { action: 'refuse', reason: 'call_limit', nextAllowedAt: frees(recent, policy.calls.perHours) };
  }
  if (entry && refresh) {
    if (!policy.refreshWhenUnchanged) return { action: 'refuse', reason: 'unchanged', nextAllowedAt: null };
    if (policy.refresh) {
      const recent = i.refreshTimes.filter((t) => toMs(t) > since(policy.refresh!.perHours));
      if (recent.length >= policy.refresh.max) return { action: 'refuse', reason: 'refresh_limit', nextAllowedAt: frees(recent, policy.refresh.perHours) };
    }
    return { action: 'call', kind: 'REFRESH' };
  }
  return { action: 'call', kind: 'MISS' };
};

/** how many refreshes are left in the window (null when the feature has none), for the screen */
export const refreshesLeft = (policy: AiPolicy, refreshTimes: (Date | string)[], now: Date): number | null => {
  if (!policy.refresh) return null;
  const recent = refreshTimes.filter((t) => toMs(t) > now.getTime() - policy.refresh!.perHours * HOUR);
  return Math.max(0, policy.refresh.max - recent.length);
};

/** the words for a refusal */
export const refusalMessage = (reason: 'unchanged' | 'refresh_limit' | 'call_limit', nextAllowedAt: Date | null, now: Date, what: string): string => {
  if (reason === 'unchanged') return `Nothing it is based on has changed since the ${what} was written, so it would come out the same. It is kept until something new is added.`;
  const wait = nextAllowedAt ? Math.max(1, Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 60000)) : null;
  const when = wait === null ? 'later' : wait >= 90 ? `in about ${Math.round(wait / 60)} hours` : `in about ${wait} minutes`;
  return reason === 'call_limit'
    ? `That is a lot of requests to the assistant in a short time. Try again ${when}.`
    : `The ${what} has been written again as often as is allowed for now. Try again ${when}.`;
};
