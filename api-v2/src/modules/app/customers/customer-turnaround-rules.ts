/**
 * Turnaround: a customer was contacted, then bought again. Pure rules (no framework, no database) so they are tested on their own.
 *
 * A contact turns around when the customer has a completed bill after it, within a window of days. A refill reminder is judged by a bill with a chronic
 * medicine in the shorter window; any other reason to get in touch by any bill in the longer one. A bill is credited to the latest counted contact before it
 * whose window it falls in, so two people never both claim it. Days are Indian days (a bill at 11 pm and a call at 9 am are the same day).
 */
export interface TContact {
  id: number; customerId: number; userId: number; at: Date;
  audience: string | null; outcome: string; source: string; dueOn: string | null;
}
export interface TBill { customerId: number; at: Date; value: number; chronic: boolean }
export interface TWindows { refillDays: number; lapsedDays: number }

export type TStatus = 'came_back' | 'waiting' | 'lapsed' | 'superseded' | 'not_counted';
export interface TResult {
  contact: TContact; status: TStatus;
  /** the kind of contact: a refill reminder, or any other reason to get in touch */
  kind: 'refill' | 'other';
  windowDays: number;
  /** came_back: the bill that did it */
  billAt?: Date; value?: number; daysToReturn?: number;
  /** came_back, refill contact with a due date: days the bill came after the day the refill was due (negative: early) */
  daysAfterDue?: number | null;
  /** waiting: days left in the window, today included */
  daysLeft?: number;
}

/** what never counts as a contact that could turn around: nobody was reached, or the customer asked to be left alone */
export const NOT_REACHED_OUTCOMES = ['NO_ANSWER', 'WRONG_NUMBER', 'ASKED_TO_STOP'];
/** reasons to get in touch where "bought again" does not mean the same thing (paying dues, a review invite) */
export const NO_TURNAROUND_AUDIENCES = ['dues', 'review_invite'];

export const DEFAULT_WINDOWS: TWindows = { refillDays: 7, lapsedDays: 14 };

const DAY_MS = 86400000;
const IST_MS = 330 * 60000;
/** the Indian day a moment falls on, as a whole number (days since 1970-01-01) */
export const istDayIndex = (d: Date): number => Math.floor((d.getTime() + IST_MS) / DAY_MS);
export const dayIndexOfText = (ymd: string): number => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY_MS);
export const dayTextOfIndex = (i: number): string => new Date(i * DAY_MS).toISOString().slice(0, 10);

export const isRefillContact = (c: TContact): boolean => c.source === 'refill' || c.audience === 'due_back';

/** whether a contact is one that can turn around at all */
export function isCounted(c: TContact): boolean {
  if (NOT_REACHED_OUTCOMES.includes(c.outcome)) return false;
  if (c.audience && NO_TURNAROUND_AUDIENCES.includes(c.audience)) return false;
  return true;
}

export const windowFor = (c: TContact, w: TWindows): number => (isRefillContact(c) ? w.refillDays : w.lapsedDays);

/**
 * What became of each contact. `now` is the moment of asking: a contact whose window is still open and has no bill yet is waiting, one whose window is
 * over is lapsed. Contacts that cannot turn around (nobody reached, dues) come back as not_counted so a screen can still list them.
 */
export function evaluate(contacts: TContact[], bills: TBill[], windows: TWindows, now: Date = new Date()): TResult[] {
  const today = istDayIndex(now);
  const out = new Map<number, TResult>();
  const byCustomer = new Map<number, { contacts: TContact[]; bills: TBill[] }>();
  const slot = (id: number) => { let s = byCustomer.get(id); if (!s) { s = { contacts: [], bills: [] }; byCustomer.set(id, s); } return s; };

  for (const c of contacts) {
    const kind = isRefillContact(c) ? 'refill' : 'other';
    out.set(c.id, { contact: c, status: isCounted(c) ? 'waiting' : 'not_counted', kind, windowDays: windowFor(c, windows) });
    if (isCounted(c)) slot(c.customerId).contacts.push(c);
  }
  for (const b of bills) if (byCustomer.has(b.customerId)) byCustomer.get(b.customerId)!.bills.push(b);

  for (const { contacts: cs, bills: bs } of byCustomer.values()) {
    cs.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
    bs.sort((a, b) => a.at.getTime() - b.at.getTime());
    const lost = new Set<number>();                                   // eligible for a bill that was credited to a later contact
    for (const b of bs) {
      const day = istDayIndex(b.at);
      const eligible = cs.filter((c) => {
        const r = out.get(c.id)!;
        if (r.status === 'came_back') return false;                  // already turned around once
        if (c.at.getTime() >= b.at.getTime()) return false;           // the bill came before the contact
        if (day > istDayIndex(c.at) + r.windowDays) return false;     // outside the window
        return !(r.kind === 'refill' && !b.chronic);                  // a refill reminder wants a chronic medicine
      });
      if (!eligible.length) continue;
      const winner = eligible[eligible.length - 1];                   // the latest contact takes the credit
      for (const c of eligible) if (c !== winner) lost.add(c.id);
      const r = out.get(winner.id)!;
      r.status = 'came_back'; r.billAt = b.at; r.value = b.value;
      r.daysToReturn = day - istDayIndex(winner.at);
      r.daysAfterDue = winner.dueOn ? day - dayIndexOfText(winner.dueOn) : null;
    }
    for (const c of cs) {
      const r = out.get(c.id)!;
      if (r.status === 'came_back') continue;
      if (lost.has(c.id)) { r.status = 'superseded'; continue; }
      const last = istDayIndex(c.at) + r.windowDays;
      if (today > last) r.status = 'lapsed';
      else { r.status = 'waiting'; r.daysLeft = last - today + 1; }
    }
  }
  return [...out.values()];
}

export interface TSummary {
  /** contacts that could turn around (everything except not_counted) */
  contacts: number;
  /** attempts where nobody was reached, or the audience is not measured */
  notCounted: number;
  cameBack: number; waiting: number; lapsed: number; superseded: number;
  /** came back out of those decided (came back or lapsed); null until something is decided */
  ratePct: number | null;
  /** median days from contact to bill, for those who came back; null when none did */
  medianDays: number | null;
  value: number;
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function summarise(results: TResult[]): TSummary {
  const count = (s: TStatus) => results.filter((r) => r.status === s).length;
  const back = results.filter((r) => r.status === 'came_back');
  const decided = back.length + count('lapsed');
  return {
    contacts: results.length - count('not_counted'),
    notCounted: count('not_counted'),
    cameBack: back.length, waiting: count('waiting'), lapsed: count('lapsed'), superseded: count('superseded'),
    ratePct: decided ? Math.round((back.length / decided) * 100) : null,
    medianDays: median(back.map((r) => r.daysToReturn!)),
    value: Math.round(back.reduce((s, r) => s + (r.value || 0), 0) * 100) / 100,
  };
}

/** the summary for each person who made contacts */
export function summariseByPerson(results: TResult[]): { userId: number; summary: TSummary }[] {
  const by = new Map<number, TResult[]>();
  for (const r of results) { const a = by.get(r.contact.userId); if (a) a.push(r); else by.set(r.contact.userId, [r]); }
  return [...by.entries()].map(([userId, rs]) => ({ userId, summary: summarise(rs) })).sort((a, b) => b.summary.contacts - a.summary.contacts);
}
