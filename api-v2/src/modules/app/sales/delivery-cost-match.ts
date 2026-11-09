/**
 * Finding which entry that was already recorded belongs to which delivery's cost, so the two can be linked instead of the same cost being counted twice
 * (expenses entered separately, deliveries with an amount, both already there). Pure, so tested without a database.
 *
 * An entry is a candidate for a delivery only when the amount is exactly the same, it is at the same store (or is a business-level expense), and it is
 * dated within a week of the delivery. It is a "sure" match when it is also within three days at the same store and says it is about a delivery (the
 * logistics or transport category, or "delivery" / "courier" / the bill number / who delivered in its words). A bulk suggestion is made only when it is
 * sure and no other delivery and no other entry could be the pair: a doubt is left for a person to decide.
 */

export const MAX_DAYS = 7;
export const SURE_DAYS = 3;

export interface DeliveryRef {
  saleId: number; billNo: string | number | null; storeId: number | null; cost: number;
  /** the day it happened: delivered, else scheduled, else booked, else the bill's day (YYYY-MM-DD) */
  day: string;
  receiver: string | null; by: string | null; partner: string | null;
}
export interface EntryRef {
  kind: 'CASH' | 'DIGITAL'; id: number; storeId: number | null; amount: number; day: string;
  /** what it says: description, payee, bill no */
  text: string | null;
  /** it is filed under logistics / transport and courier */
  categoryHint: boolean;
}
export interface Match { saleId: number; kind: 'CASH' | 'DIGITAL'; entryId: number; level: 'sure' | 'maybe'; days: number; reasons: string[] }

const MS = 86400000;
const t = (d: string) => Date.parse(String(d).slice(0, 10) + 'T00:00:00Z');
export const daysApart = (a: string, b: string): number => Math.abs(Math.round((t(a) - t(b)) / MS));

const words = (s: string | null) => String(s ?? '').toLowerCase().replace(/[^a-z0-9#]+/g, ' ').split(' ').filter((w) => w.length >= 4);

/** what in the entry's words points at this delivery */
const textReasons = (d: DeliveryRef, e: EntryRef): string[] => {
  const text = ` ${String(e.text ?? '').toLowerCase()} `;
  const out: string[] = [];
  if (/deliver|courier|dispatch|parcel/.test(text)) out.push('says delivery or courier');
  if (d.billNo !== null && d.billNo !== undefined && new RegExp(`(^|[^0-9])${String(d.billNo).replace(/[^0-9a-z]/gi, '')}([^0-9]|$)`).test(text) && String(d.billNo).length >= 3) out.push('names the bill');
  const names = [...words(d.by), ...words(d.partner), ...words(d.receiver)];
  if (names.some((w) => text.includes(w))) out.push('names who delivered or received');
  return out;
};

/** how well an entry fits a delivery: null when it cannot be its cost */
export const matchOf = (d: DeliveryRef, e: EntryRef): Match | null => {
  if (!(d.cost > 0) || Math.abs(d.cost - e.amount) >= 0.005) return null;
  if (d.storeId !== null && e.storeId !== null && d.storeId !== e.storeId) return null;
  const days = daysApart(d.day, e.day);
  if (days > MAX_DAYS) return null;
  const reasons = [...(e.categoryHint ? ['filed under transport and courier'] : []), ...textReasons(d, e)];
  const sameStore = d.storeId !== null && e.storeId === d.storeId;
  const level = days <= SURE_DAYS && sameStore && reasons.length > 0 ? 'sure' : 'maybe';
  return { saleId: d.saleId, kind: e.kind, entryId: e.id, level, days, reasons };
};

/** the entries that could be this delivery's cost, best first (sure before maybe, then nearest in date) */
export const matchesFor = (d: DeliveryRef, entries: EntryRef[]): Match[] =>
  entries.map((e) => matchOf(d, e)).filter((m): m is Match => !!m)
    .sort((a, b) => (a.level === b.level ? a.days - b.days : a.level === 'sure' ? -1 : 1));

/**
 * The pairs that can be linked in one go: sure, and the only sure pair for that delivery and for that entry. Everything else is left for a person.
 * Returns the pairs, and how many deliveries had a candidate but are left for a person to decide.
 */
export const suggestLinks = (deliveries: DeliveryRef[], entries: EntryRef[]): { pairs: Match[]; undecided: number } => {
  const per = new Map<number, Match[]>();
  const byEntry = new Map<string, Match[]>();
  for (const d of deliveries) {
    const all = matchesFor(d, entries);
    if (all.length) per.set(d.saleId, all);
    for (const m of all) { const k = `${m.kind}:${m.entryId}`; const a = byEntry.get(k); if (a) a.push(m); else byEntry.set(k, [m]); }
  }
  const pairs: Match[] = [];
  let undecided = 0;
  for (const [saleId, all] of per) {
    const sure = all.filter((m) => m.level === 'sure');
    const only = sure.length === 1 && all.length === 1 ? sure[0] : null;          // the one candidate there is, and it is sure
    const unique = only ? (byEntry.get(`${only.kind}:${only.entryId}`) || []).length === 1 : false;   // and no other delivery wants the same entry
    if (only && unique) pairs.push(only); else undecided++;
    void saleId;
  }
  return { pairs, undecided };
};
