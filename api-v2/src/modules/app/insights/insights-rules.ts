/**
 * Pure rules for the insight features: date ranges, the week a summary covers, stock that will not sell before it expires, the plain-words versions
 * of the weekly summary and the staff coaching note (used when the assistant is off, and as the facts the assistant words), and the cleaners that make
 * whatever the model returns safe to show. No framework and no database, so it is unit tested.
 */

export const PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'last_7_days', 'this_month', 'last_month', 'last_30_days', 'last_90_days', 'this_year'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today', yesterday: 'Yesterday', this_week: 'This week (Monday to today)', last_week: 'Last week (Monday to Sunday)', last_7_days: 'Last 7 days',
  this_month: 'This month', last_month: 'Last month', last_30_days: 'Last 30 days', last_90_days: 'Last 90 days', this_year: 'This year',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + 'T00:00:00Z');
export const addDays = (day: string, n: number): string => iso(new Date(parse(day).getTime() + n * 86400000));
/** Monday is day 0 */
const weekday = (day: string) => (parse(day).getUTCDay() + 6) % 7;

/** a period as dates: from the first day to the day after the last (so a query reads `>= from and < to`) */
export function periodRange(period: string, today: string): { from: string; to: string; label: string } | null {
  if (!(PERIODS as readonly string[]).includes(period)) return null;
  const p = period as Period;
  const monday = addDays(today, -weekday(today));
  const firstOfMonth = today.slice(0, 8) + '01';
  const prevMonthEnd = firstOfMonth;
  const prevMonthStart = (() => { const d = parse(firstOfMonth); d.setUTCMonth(d.getUTCMonth() - 1); return iso(d); })();
  const r: Record<Period, [string, string]> = {
    today: [today, addDays(today, 1)],
    yesterday: [addDays(today, -1), today],
    this_week: [monday, addDays(today, 1)],
    last_week: [addDays(monday, -7), monday],
    last_7_days: [addDays(today, -6), addDays(today, 1)],
    this_month: [firstOfMonth, addDays(today, 1)],
    last_month: [prevMonthStart, prevMonthEnd],
    last_30_days: [addDays(today, -29), addDays(today, 1)],
    last_90_days: [addDays(today, -89), addDays(today, 1)],
    this_year: [today.slice(0, 5) + '01-01', addDays(today, 1)],
  };
  return { from: r[p][0], to: r[p][1], label: PERIOD_LABELS[p] };
}

/** the last complete Monday-to-Sunday week before `today`, and the week before it (to compare with) */
export function weekBounds(today: string): { start: string; end: string; prevStart: string; prevEnd: string } {
  const monday = addDays(today, -weekday(today));
  const start = addDays(monday, -7);
  return { start, end: addDays(start, 6), prevStart: addDays(start, -7), prevEnd: addDays(start, -1) };
}

/** a change between two figures, with the per cent when the earlier one is not zero */
export function change(now: number, before: number): { abs: number; pct: number | null; dir: 'up' | 'down' | 'flat' } {
  const abs = Math.round((now - before) * 100) / 100;
  const pct = before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null;
  return { abs, pct, dir: Math.abs(abs) < 0.005 ? 'flat' : abs > 0 ? 'up' : 'down' };
}

export const rupees = (n: number): string => {
  const v = Math.round(Number(n) || 0);
  return `Rs ${v.toLocaleString('en-IN')}`;
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : /(ch|sh|s|x)$/.test(w) ? 'es' : 's'}`;

// ------------------------------------------------------------------------------------------------ stock that will not sell before it expires
export interface BatchFacts { qty: number; daysLeft: number; perDay: number }

/** how many units of a batch will still be on the shelf on the day it expires, at the product's current selling rate (0 when it will all sell) */
export function unsoldBeforeExpiry(b: BatchFacts): number {
  if (b.qty <= 0 || b.daysLeft < 0) return 0;
  const sellable = Math.max(0, b.perDay) * b.daysLeft;
  return Math.max(0, Math.ceil(b.qty - sellable));
}

export type ExpiryAction = 'return to vendor' | 'discount to clear' | 'sell first' | 'watch';
/** what to do about a batch that will not all sell: a vendor will often take it back with a few months left; later, clear it at a discount */
export function expiryAction(b: BatchFacts & { unsold: number }): ExpiryAction {
  if (b.unsold <= 0) return 'watch';
  if (b.daysLeft > 120) return 'return to vendor';
  if (b.perDay > 0 && b.unsold / b.qty < 0.5) return 'sell first';
  return 'discount to clear';
}

// ------------------------------------------------------------------------------------------------ the weekly summary
export interface WeeklyFacts {
  week: { start: string; end: string };
  sales: { value: number; bills: number; avgBill: number; prevValue: number; prevBills: number };
  mix: { cash: number; digital: number; credit: number };
  margin: { pct: number | null; prevPct: number | null; coverage: number } | null;
  topProducts: { name: string; value: number }[];
  topStaff: { name: string; bills: number; value: number }[];
  expenses: { total: number; prevTotal: number };
  returns: { count: number; value: number };
  dues: { outstanding: number; customers: number };
  expiry: { atRiskValue: number; atRiskBatches: number; expiredValue: number };
  stock: { outOfStockSelling: number };
  shifts: { closed: number; withDifference: number };
  attendance: { late: number; missing: number };
  deliveries: { total: number; failed: number };
}

export interface Narrative { headline: string; wins: string[]; watch: string[]; doFirst: string[] }

const pctText = (c: { pct: number | null; dir: string }) => (c.pct === null ? '' : ` (${c.pct > 0 ? '+' : ''}${c.pct}%)`);

/** the summary in plain words from the facts alone: what the assistant is given to improve on, and what the owner gets without it */
export function plainWeekly(f: WeeklyFacts): Narrative {
  const s = change(f.sales.value, f.sales.prevValue);
  const wins: string[] = [];
  const watch: string[] = [];
  const doFirst: string[] = [];
  const headline = f.sales.bills === 0
    ? 'No sales were recorded last week.'
    : `Sales were ${rupees(f.sales.value)} from ${plural(f.sales.bills, 'bill')}${s.dir === 'flat' ? ', the same as the week before' : `, ${s.dir === 'up' ? 'up' : 'down'} ${rupees(Math.abs(s.abs))}${pctText(s)} on the week before`}.`;
  if (s.dir === 'up' && f.sales.prevValue > 0) wins.push(`Sales rose ${rupees(s.abs)}${pctText(s)}.`);
  if (f.margin?.pct !== null && f.margin && f.margin.prevPct !== null && f.margin.pct !== null && f.margin.pct > f.margin.prevPct) wins.push(`Gross margin improved to ${f.margin.pct}% from ${f.margin.prevPct}%.`);
  if (f.topProducts.length) wins.push(`Best sellers: ${f.topProducts.slice(0, 3).map((p) => `${p.name} (${rupees(p.value)})`).join(', ')}.`);
  if (f.topStaff.length > 1) wins.push(`${f.topStaff[0].name} served the most: ${plural(f.topStaff[0].bills, 'bill')}, ${rupees(f.topStaff[0].value)}.`);
  if (s.dir === 'down' && f.sales.prevValue > 0 && (s.pct ?? 0) <= -5) watch.push(`Sales fell ${rupees(Math.abs(s.abs))}${pctText(s)}.`);
  if (f.margin && f.margin.pct !== null && f.margin.prevPct !== null && f.margin.pct < f.margin.prevPct - 1) watch.push(`Gross margin slipped to ${f.margin.pct}% from ${f.margin.prevPct}%.`);
  if (f.expiry.atRiskBatches > 0) { watch.push(`${plural(f.expiry.atRiskBatches, 'batch')} worth ${rupees(f.expiry.atRiskValue)} at cost will not sell before it expires.`); doFirst.push('Open Purchases > Reorder, press Write the brief, and return or discount the batches that will not sell.'); }
  if (f.expiry.expiredValue > 0) watch.push(`Expired stock on the shelf is worth ${rupees(f.expiry.expiredValue)} at cost.`);
  if (f.stock.outOfStockSelling > 0) { watch.push(`${plural(f.stock.outOfStockSelling, 'product')} that sold recently ${f.stock.outOfStockSelling === 1 ? 'is' : 'are'} out of stock.`); doFirst.push('Open Purchases > Reorder and order the products that are out of stock.'); }
  if (f.dues.outstanding > 0) { watch.push(`${plural(f.dues.customers, 'customer')} owe ${rupees(f.dues.outstanding)} on credit.`); doFirst.push('Open Customers > Contact today and send the dues reminders.'); }
  if (f.shifts.withDifference > 0) { watch.push(`${plural(f.shifts.withDifference, 'shift')} of ${f.shifts.closed} closed with a drawer or terminal difference.`); doFirst.push('Check the shifts that closed with a difference.'); }
  if (f.attendance.late > 0) watch.push(`${plural(f.attendance.late, 'late arrival')} recorded.`);
  if (f.attendance.missing > 0) { watch.push(`${plural(f.attendance.missing, 'attendance day')} still ${f.attendance.missing === 1 ? 'needs' : 'need'} review.`); doFirst.push('Review the attendance days that are waiting.'); }
  if (f.deliveries.failed > 0) watch.push(`${plural(f.deliveries.failed, 'delivery')} of ${f.deliveries.total} failed.`);
  const e = change(f.expenses.total, f.expenses.prevTotal);
  if (f.expenses.total > 0 && e.dir === 'up' && (e.pct ?? 0) >= 25 && f.expenses.prevTotal > 0) watch.push(`Expenses were ${rupees(f.expenses.total)}, up ${e.pct}% on the week before.`);
  if (!doFirst.length) doFirst.push(f.sales.bills === 0 ? 'Check that bills are being entered.' : 'Nothing urgent. Keep an eye on the numbers above.');
  return { headline, wins: wins.slice(0, 5), watch: watch.slice(0, 6), doFirst: doFirst.slice(0, 4) };
}

// ------------------------------------------------------------------------------------------------ staff coaching
export interface CoachingFacts {
  period: string;
  role: string | null;
  kpi: { percent: number | null; band: string | null; prevPercent: number | null; teamAvg: number | null; measures: { name: string; points: number; max: number }[] } | null;
  attendance: { present: number; late: number; earlyOut: number; prevPresent: number };
  sales: { bills: number; value: number; prevBills: number; prevValue: number; teamAvgBills: number | null } | null;
  leaveDays: number;
}

export interface Coaching { strengths: string[]; focus: string[]; tips: string[]; talk: string[] }

const share = (m: { points: number; max: number }) => (m.max > 0 ? m.points / m.max : 0);

/** the facts in plain words: what went well, where to focus, a practical tip for each and what to say in the conversation */
export function plainCoaching(f: CoachingFacts): Coaching {
  const strengths: string[] = [];
  const focus: string[] = [];
  const tips: string[] = [];
  const talk: string[] = [];
  const k = f.kpi;
  if (k && k.percent !== null) {
    const d = k.prevPercent !== null ? change(k.percent, k.prevPercent) : null;
    if (k.percent >= 85) strengths.push(`A strong KPI score of ${k.percent}%${k.band ? ` (${k.band})` : ''}.`);
    if (d && d.dir === 'up' && (d.abs >= 3)) strengths.push(`The KPI score rose ${d.abs} points on last month.`);
    if (d && d.dir === 'down' && d.abs <= -3) focus.push(`The KPI score fell ${Math.abs(d.abs)} points on last month, to ${k.percent}%.`);
    if (k.teamAvg !== null && k.percent < k.teamAvg - 5) focus.push(`The KPI score of ${k.percent}% is below the team average of ${k.teamAvg}%.`);
    const sorted = [...k.measures].filter((m) => m.max > 0).sort((a, b) => share(a) - share(b));
    const weak = sorted.filter((m) => share(m) < 0.7).slice(0, 2);
    const strong = sorted.filter((m) => share(m) >= 0.9).slice(-2).reverse();
    for (const m of strong) strengths.push(`Full marks or close on ${m.name} (${m.points} of ${m.max}).`);
    for (const m of weak) { focus.push(`${m.name} scored ${m.points} of ${m.max}.`); tips.push(`For ${m.name}: agree one small habit to practise this month, and check it together in two weeks.`); }
  }
  const a = f.attendance;
  if (a.late >= 3) { focus.push(`${plural(a.late, 'late arrival')} this month.`); tips.push('Ask what makes the start of the shift hard (travel, family, the shift time) and see whether anything can be changed.'); }
  else if (a.present >= 20 && a.late === 0) strengths.push(`On time every day this month (${a.present} days present).`);
  if (a.earlyOut >= 3) focus.push(`${plural(a.earlyOut, 'early departure')} this month.`);
  if (f.sales) {
    const s = f.sales;
    const c = change(s.value, s.prevValue);
    if (s.prevValue > 0 && c.dir === 'up' && (c.pct ?? 0) >= 10) strengths.push(`Sales served rose ${c.pct}% on last month (${rupees(s.value)} from ${plural(s.bills, 'bill')}).`);
    if (s.prevValue > 0 && c.dir === 'down' && (c.pct ?? 0) <= -15) focus.push(`Sales served fell ${Math.abs(c.pct ?? 0)}% on last month.`);
    if (s.teamAvgBills !== null && s.teamAvgBills > 0 && s.bills < s.teamAvgBills * 0.6) tips.push('Few bills compared with the team: check that this person is at the counter enough, and not mostly on other work.');
  }
  if (!strengths.length) strengths.push('Turned up and did the work; there is not enough data yet to say more.');
  if (!focus.length) focus.push('Nothing stands out as a problem this month.');
  if (!tips.length) tips.push('Ask what would make the job easier, and note one thing to try.');
  talk.push('Start with what went well and thank them for it.');
  if (focus.length && focus[0] !== 'Nothing stands out as a problem this month.') talk.push('Ask how they see the month before giving your view, then agree one or two things to work on.');
  talk.push('Close by agreeing what you will both do, and when you will check again.');
  return { strengths: strengths.slice(0, 6), focus: focus.slice(0, 6), tips: tips.slice(0, 5), talk: talk.slice(0, 4) };
}

// ------------------------------------------------------------------------------------------------ cleaning what the model returns
export const clip = (v: unknown, n: number): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const list = (v: unknown, max: number, len: number): string[] => (Array.isArray(v) ? v.map((x) => clip(x, len)).filter(Boolean).slice(0, max) : []);

export function cleanNarrative(out: any, fallback: Narrative): Narrative {
  const headline = clip(out?.headline, 240);
  const wins = list(out?.wins, 5, 240);
  const watch = list(out?.watch, 6, 240);
  const doFirst = list(out?.do_first ?? out?.doFirst, 4, 240);
  if (!headline || (!wins.length && !watch.length)) return fallback;
  return { headline, wins, watch, doFirst: doFirst.length ? doFirst : fallback.doFirst };
}

export function cleanCoaching(out: any, fallback: Coaching): Coaching {
  const strengths = list(out?.strengths, 4, 240);
  const focus = list(out?.focus, 4, 240);
  const tips = list(out?.tips, 4, 240);
  const talk = list(out?.talk_points ?? out?.talk, 4, 240);
  if (!strengths.length && !focus.length) return fallback;
  return { strengths: strengths.length ? strengths : fallback.strengths, focus: focus.length ? focus : fallback.focus, tips: tips.length ? tips : fallback.tips, talk: talk.length ? talk : fallback.talk };
}

// ------------------------------------------------------------------------------------------------ the buying brief
export interface ReorderLine { title: string; qty: number; daysLeft: number | null; reasons: string[] }
export interface RiskLine { product: string; unsold: number; value: number; daysLeft: number; action: string }
export interface Brief { headline: string; buyFirst: string[]; clear: string[]; watch: string[] }

/** the brief in plain words: what is nearly out and selling fast, and what to return or discount */
export function plainBrief(reorder: ReorderLine[], risk: RiskLine[]): Brief {
  const urgent = reorder.filter((r) => r.qty > 0 && ((r.daysLeft !== null && r.daysLeft <= 7) || r.reasons.some((x) => /urgent|below zero|customer request|fast moving/i.test(x))))
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)).slice(0, 6);
  const buyFirst = urgent.map((r) => `${r.title}: order ${r.qty}${r.daysLeft !== null ? `, about ${r.daysLeft} days of stock left` : ''}.`);
  const clear = risk.slice(0, 6).map((r) => `${r.product}: ${r.unsold} unit${r.unsold === 1 ? '' : 's'} (${rupees(r.value)} at cost) will not sell in ${r.daysLeft} days. ${r.action[0].toUpperCase()}${r.action.slice(1)}.`);
  const watch: string[] = [];
  const slow = reorder.filter((r) => r.reasons.some((x) => /slow mover/i.test(x))).length;
  if (slow) watch.push(`${plural(slow, 'product')} on the list ${slow === 1 ? 'is a' : 'are'} slow mover${slow === 1 ? '' : 's'}: check before reordering.`);
  const total = risk.reduce((n, r) => n + r.value, 0);
  const headline = reorder.length === 0 && risk.length === 0
    ? 'Nothing needs ordering and nothing is at risk of expiring unsold.'
    : `${plural(reorder.filter((r) => r.qty > 0).length, 'product')} to order${risk.length ? `, and ${rupees(total)} of stock at risk of expiring unsold` : ''}.`;
  return { headline, buyFirst, clear, watch };
}

export function cleanBrief(out: any, fallback: Brief): Brief {
  const headline = clip(out?.headline, 240);
  const buyFirst = list(out?.buy_first ?? out?.buyFirst, 8, 240);
  const clearList = list(out?.clear, 8, 240);
  const watch = list(out?.watch_out ?? out?.watch, 5, 240);
  if (!headline || (!buyFirst.length && !clearList.length)) return fallback;
  return { headline, buyFirst, clear: clearList, watch };
}
