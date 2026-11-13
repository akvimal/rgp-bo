import { BIG_DISCOUNT_PCT, LATE_RETURN_DAYS } from './review-rules';

/**
 * The weekly review at a glance: one tile per thing the reader checks and a short list of what to look at first, in plain words. It is built from the
 * figures the review already has (the week's summary, the marked items, the verdicts against what is usual and the cash drawers), so it never disagrees
 * with the tables below it. A volume (sales, bills) above or below usual is only noted; an exception above usual, or one marked for a closer look, is a flag.
 */
export type TileState = 'look' | 'ok' | 'none';
export interface Tile { key: string; label: string; state: TileState; main: string; note: string; anchor: string }
export interface Flag { key: string; text: string; anchor: string }
export interface Glance { tiles: Tile[]; flags: Flag[]; quiet: boolean; hasUsual: boolean }

interface GlanceIn {
  summary: { bills: number; sales: number; discountBills: number; discountValue: number; belowList: number; belowListValue: number; voids: number; voidValue: number; edits: number; editReduced: number; returns: number; returnValue: number };
  marked: { bigDiscounts: number; lateVoids: number; flaggedEdits: number; lateReturns: number };
  verdicts: Record<string, string>;
  cash: { closed: number; off: number; short: number; over: number; shortTotal: number; overTotal: number; unclosed: number } | null;
}

const money = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const join = (parts: (string | null | false)[]) => parts.filter(Boolean).join('; ');

const volumeNote = (v: string) => (v === 'above' ? 'higher than normal' : v === 'below' ? 'lower than normal' : v === 'usual' ? 'as normal' : '');

export function glanceOf(i: GlanceIn): Glance {
  const s = i.summary, m = i.marked, v = i.verdicts || {};
  const hasUsual = Object.values(v).some((x) => x && x !== 'unknown');
  const tiles: Tile[] = [];
  const flags: Flag[] = [];

  tiles.push({ key: 'sales', label: 'Sales', state: v.sales && v.sales !== 'unknown' ? 'ok' : 'none', main: money(s.sales), note: volumeNote(v.sales), anchor: 'review-summary' });
  tiles.push({ key: 'bills', label: 'Bills', state: v.bills && v.bills !== 'unknown' ? 'ok' : 'none', main: String(s.bills), note: volumeNote(v.bills), anchor: 'review-summary' });

  /** one exception: a tile, and a flag when it is above usual or marked for a closer look */
  const exception = (key: string, label: string, count: number, verdict: string | undefined, markedN: number, main: string, text: string, markedText: string, anchor: string) => {
    const above = verdict === 'above';
    const look = count > 0 && (above || markedN > 0);
    const state: TileState = count === 0 ? 'ok' : look ? 'look' : verdict === 'unknown' || !verdict ? 'none' : 'ok';
    const note = count === 0 ? 'none this week' : look ? join([above && 'more than normal', markedN > 0 && markedText]) : verdict === 'unknown' || !verdict ? 'nothing to compare with yet' : verdict === 'below' ? 'fewer than normal' : 'as normal';
    tiles.push({ key, label, state, main, note, anchor });
    if (look) flags.push({ key, text: `${text}${above ? ', more than normal' : ''}${markedN > 0 ? ` (${markedText})` : ''}.`, anchor });
  };

  const cash = i.cash;
  const cashLook = !!cash && (cash.off > 0 || cash.unclosed > 0);
  tiles.push({
    key: 'cash', label: 'Cash drawers', state: !cash ? 'none' : cashLook ? 'look' : 'ok',
    main: !cash ? '-' : cash.off === 0 && cash.unclosed === 0 ? 'All tally' : join([cash.off > 0 && `${cash.off} out`, cash.unclosed > 0 && `${cash.unclosed} not closed`]),
    note: !cash ? 'no shifts' : cashLook ? '' : `${plural(cash.closed, 'shift')} closed`, anchor: 'review-cash',
  });
  if (cash && cash.off > 0) flags.push({ key: 'cash-off', text: `${plural(cash.off, 'cash drawer')} out by more than ₹1 (${join([cash.short > 0 && `${money(cash.shortTotal)} short`, cash.over > 0 && `${money(cash.overTotal)} over`])}).`, anchor: 'review-cash' });
  if (cash && cash.unclosed > 0) flags.push({ key: 'cash-unclosed', text: `${plural(cash.unclosed, 'shift was', 'shifts were')} opened and never closed.`, anchor: 'review-cash' });

  exception('edits', 'Edited after billing', s.edits, v.edits, m.flaggedEdits, String(s.edits),
    `${plural(s.edits, 'bill')} edited after billing${s.editReduced > 0 ? `, totals lowered by ${money(s.editReduced)}` : ''}`, `${m.flaggedEdits} flagged`, 'review-edits');
  exception('voids', 'Held bills discarded', s.voids, v.voids, m.lateVoids, String(s.voids),
    `${plural(s.voids, 'held bill')} discarded (${money(s.voidValue)})`, `${m.lateVoids} discarded a day or more after being made`, 'review-voids');
  exception('discounts', 'Discounts', s.discountBills, v.discount, m.bigDiscounts, String(s.discountBills),
    `${plural(s.discountBills, 'bill')} with a discount (${money(s.discountValue)})`, `${m.bigDiscounts} of ${BIG_DISCOUNT_PCT}% or more off the bill`, 'review-discounts');
  exception('below', 'Below list price', s.belowList, v.below, 0, String(s.belowList),
    `${plural(s.belowList, 'item')} billed below the list price (${money(s.belowListValue)})`, '', 'review-below');
  exception('returns', 'Returns', s.returns, v.returns, m.lateReturns, String(s.returns),
    `${plural(s.returns, 'return')} (${money(s.returnValue)})`, `${m.lateReturns} came ${LATE_RETURN_DAYS} or more days after the bill`, 'review-returns');

  // the business side: only a worry when it moves the wrong way
  if (v.margin === 'below') flags.push({ key: 'margin', text: 'The margin is lower than normal for these days.', anchor: 'review-mix' });
  if (v.unmet === 'above') flags.push({ key: 'unmet', text: 'More customer requests could not be met than normal.', anchor: 'review-mix' });

  return { tiles, flags, quiet: flags.length === 0, hasUsual };
}
