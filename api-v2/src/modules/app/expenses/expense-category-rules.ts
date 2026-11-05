/**
 * Expense categories have a level (where the cost is paid) and a group (the kind of cost). The rules here need no database.
 *   STORE    always booked to a store (water, cleaning, repairs: paid by the Store Head)
 *   BUSINESS booked at business level only (the Business Head)
 *   BOTH     either (rent, electricity: a store pays them, or the Business Head does)
 */
export type Level = 'STORE' | 'BUSINESS' | 'BOTH';
export const LEVELS: Level[] = ['STORE', 'BUSINESS', 'BOTH'];
export const GROUPS = ['Premises', 'People', 'Operations', 'Technology', 'Compliance and finance', 'Marketing', 'Other'];
/** how often a repeating expense comes, in months (a yearly subscription is 12) */
export const EVERY_MONTHS = [1, 3, 6, 12];

/** does a repeating expense that starts in `start` and comes every `every` months fall in `period` (both YYYY-MM) */
export function fallsIn(start: string, period: string, every: number): boolean {
  if (period < start) return false;
  const gap = (+period.slice(0, 4) - +start.slice(0, 4)) * 12 + (+period.slice(5, 7) - +start.slice(5, 7));
  return gap % Math.max(1, every) === 0;
}
export const DEFAULT_GROUP = 'Other';

export const levelLabel = (l: Level): string => (l === 'STORE' ? 'a store' : l === 'BUSINESS' ? 'business level' : 'a store or business level');

/** what is wrong with booking this category to this store (null for business level); null when it fits */
export function levelProblem(name: string, level: Level | string, storeId: number | null): string | null {
  if (level === 'STORE' && !storeId) return `${name} is paid at a store: choose the store.`;
  if (level === 'BUSINESS' && storeId) return `${name} is a business-level expense: leave the store empty.`;
  return null;
}

/** the level and group from what was typed on the setup page; throws a plain sentence when one is not allowed */
export function cleanCategoryKind(b: any, current?: { level: string; cost_group: string }): { level: Level; cost_group: string } {
  const level = (b?.level ?? current?.level ?? 'BOTH') as Level;
  if (!LEVELS.includes(level)) throw new Error('Level is store, business or both.');
  const group = String(b?.cost_group ?? current?.cost_group ?? DEFAULT_GROUP).trim();
  if (!GROUPS.includes(group)) throw new Error(`Group is one of: ${GROUPS.join(', ')}.`);
  return { level, cost_group: group };
}

/** the categories offered for an expense at this store (null = business level) */
export function offered<T extends { level: string }>(categories: T[], storeId: number | null): T[] {
  return categories.filter((c) => (storeId ? c.level !== 'BUSINESS' : c.level !== 'STORE'));
}

export interface GroupRow { name: string; amount: number; gst: number; categories: { name: string; amount: number }[] }

/** the report rows rolled up by group, each with its categories, biggest first */
export function rollUpByGroup(rows: { category: string; group: string; amount: number; gst: number }[]): GroupRow[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const groups = new Map<string, GroupRow & { cats: Map<string, number> }>();
  for (const r of rows) {
    const g = groups.get(r.group) ?? { name: r.group, amount: 0, gst: 0, categories: [], cats: new Map<string, number>() };
    g.amount = r2(g.amount + r.amount);
    g.gst = r2(g.gst + r.gst);
    g.cats.set(r.category, r2((g.cats.get(r.category) ?? 0) + r.amount));
    groups.set(r.group, g);
  }
  return Array.from(groups.values())
    .map((g) => ({ name: g.name, amount: g.amount, gst: g.gst, categories: Array.from(g.cats, ([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) }))
    .sort((a, b) => b.amount - a.amount);
}
