import { NO_TURNAROUND_AUDIENCES, TResult, TWindows, isRefillContact, istDayIndex } from './customer-turnaround-rules';

/**
 * The retry ladder (docs/planning/REFILL_CRM_DASHBOARD.md, step 5). Pure rules, no framework and no database.
 *
 *   1. A contact did not get through (no answer, or "call back later"): after a few days the person who made it is reminded to call again.
 *   2. A message was sent and the customer has not bought: after a few days the person is reminded to nudge.
 *   3. Each retry counts as a try; after the last try the reminders stop, and when the customer's return window has passed without a purchase the contact is
 *      counted as lapsed and goes into the weekly roll-up for the managers.
 * Nothing is sent to the customer: a reminder is for a person, who decides how to reach out. A customer who declined messages or asked to be left alone is
 * filtered out before these rules run.
 */
export interface LadderParams { refillRetryDays: number; otherRetryDays: number; maxTries: number }
export const DEFAULT_LADDER: LadderParams = { refillRetryDays: 3, otherRetryDays: 5, maxTries: 3 };

/** the outcomes that leave a customer worth trying again */
export const RETRY_OUTCOMES = ['NO_ANSWER', 'CALLBACK', 'SENT'];

export interface LadderContact {
  customerId: number;
  /** the latest contact with this customer */
  at: Date;
  audience: string | null;
  source: string;
  outcome: string;
  /** contacts since the customer's last bill that did not get a purchase out of them (no answer, call back, message sent) */
  tries: number;
  /** whether the customer has bought since that contact */
  bought: boolean;
}

export interface RetryAdvice {
  /** call again after no answer or a call-back request; nudge after a message that got no reply */
  action: 'call_again' | 'nudge';
  daysSince: number;
  /** days left in the customer's return window, today included */
  daysLeft: number;
  /** which try this would be (the first retry is try 2) */
  nextTry: number;
}

/** whether the person who made this contact should be reminded to try again today, and how */
export function retryAdvice(c: LadderContact, windows: TWindows, p: LadderParams, now: Date = new Date()): RetryAdvice | null {
  if (!RETRY_OUTCOMES.includes(c.outcome)) return null;
  if (c.audience && NO_TURNAROUND_AUDIENCES.includes(c.audience)) return null;     // dues and review invites are not chased this way
  if (c.bought) return null;                                                         // they came back: nothing to chase
  if (c.tries >= p.maxTries) return null;                                            // enough tries: the roll-up takes it from here
  const refill = isRefillContact({ id: 0, customerId: c.customerId, userId: 0, at: c.at, audience: c.audience, outcome: c.outcome, source: c.source, dueOn: null });
  const window = refill ? windows.refillDays : windows.lapsedDays;
  const retryAfter = refill ? p.refillRetryDays : p.otherRetryDays;
  const daysSince = istDayIndex(now) - istDayIndex(c.at);
  if (daysSince < retryAfter || daysSince > window) return null;                    // too soon, or the window is over
  return { action: c.outcome === 'SENT' ? 'nudge' : 'call_again', daysSince, daysLeft: window - daysSince + 1, nextTry: c.tries + 1 };
}

/**
 * The contacts whose return window ended in the last `recentDays` days without a purchase, one per customer (the latest contact), most recent first.
 * These are what the managers are told about, once a week and only when there are enough to matter.
 */
export function recentlyLapsed(results: TResult[], recentDays: number, now: Date = new Date()): TResult[] {
  const today = istDayIndex(now);
  const latest = new Map<number, TResult>();
  for (const r of results) {
    if (r.status !== 'lapsed') continue;
    const endedDaysAgo = today - (istDayIndex(r.contact.at) + r.windowDays);
    if (endedDaysAgo < 1 || endedDaysAgo > recentDays) continue;
    const had = latest.get(r.contact.customerId);
    if (!had || r.contact.at.getTime() > had.contact.at.getTime()) latest.set(r.contact.customerId, r);
  }
  return [...latest.values()].sort((a, b) => b.contact.at.getTime() - a.contact.at.getTime());
}

/** the Monday of the week a day (YYYY-MM-DD) is in: the roll-up is one alert a week */
export function weekStartOf(day: string): string {
  const t = Date.parse(day + 'T00:00:00Z');
  const dow = new Date(t).getUTCDay();                       // 0 Sunday
  return new Date(t - ((dow + 6) % 7) * 86400000).toISOString().slice(0, 10);
}
