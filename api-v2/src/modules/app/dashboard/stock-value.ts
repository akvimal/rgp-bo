/**
 * Stock value, the expiry ladder and dead stock (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2 item 7). Pure: batch totals grouped by store,
 * product category, expiry bucket and whether the product has sold lately go in; tiles, a ladder, category and store tables and plain sentences come out.
 * Values are at cost (the purchase rate before GST) and at MRP, for what is on the shelf now.
 */
export interface StockGroup { store_id: number | null; category: string; bucket: string; dead: boolean; cost: number; mrp: number; batches: number }

export const BUCKETS = [
  { key: 'expired', label: 'Already expired', danger: true },
  { key: 'd30', label: 'Expires in 30 days', danger: true },
  { key: 'd60', label: '31 to 60 days', danger: false },
  { key: 'd90', label: '61 to 90 days', danger: false },
  { key: 'd180', label: '91 to 180 days', danger: false },
  { key: 'later', label: 'More than 180 days', danger: false },
  { key: 'none', label: 'No expiry date', danger: false },
];
const r0 = (n: number) => Math.round(n);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const inr = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-IN');

/** the expiry bucket of a batch from the days left to the end of its expiry month (null = no date) */
export function bucketOf(daysLeft: number | null): string {
  if (daysLeft === null || daysLeft === undefined || Number.isNaN(daysLeft)) return 'none';
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'd30';
  if (daysLeft <= 60) return 'd60';
  if (daysLeft <= 90) return 'd90';
  if (daysLeft <= 180) return 'd180';
  return 'later';
}

export function stockValue(groups: StockGroup[], storeNames: Map<number, string>, costOfSales90: number, opts: { showStores?: boolean } = {}) {
  const total = groups.reduce((t, g) => t + g.cost, 0);
  const totalMrp = groups.reduce((t, g) => t + g.mrp, 0);
  const batches = groups.reduce((t, g) => t + g.batches, 0);
  const sum = (f: (g: StockGroup) => boolean, k: 'cost' | 'mrp' = 'cost') => groups.filter(f).reduce((t, g) => t + g[k], 0);

  const ladder = BUCKETS.map((b) => {
    const value = sum((g) => g.bucket === b.key);
    return { key: b.key, label: b.label, danger: b.danger, value: r0(value), mrp: r0(sum((g) => g.bucket === b.key, 'mrp')), share: pct(value, total), batches: groups.filter((g) => g.bucket === b.key).reduce((t, g) => t + g.batches, 0) };
  });

  const cats = new Map<string, { category: string; value: number; mrp: number; expiring: number; dead: number }>();
  for (const g of groups) {
    const c = cats.get(g.category) || { category: g.category, value: 0, mrp: 0, expiring: 0, dead: 0 };
    c.value += g.cost; c.mrp += g.mrp;
    if (g.bucket === 'expired' || g.bucket === 'd30') c.expiring += g.cost;
    if (g.dead) c.dead += g.cost;
    cats.set(g.category, c);
  }
  const byCategory = Array.from(cats.values()).sort((a, b) => b.value - a.value)
    .map((c) => ({ category: c.category, value: r0(c.value), mrp: r0(c.mrp), share: pct(c.value, total), expiring: r0(c.expiring), dead: r0(c.dead) }));

  const stores = new Map<number, { storeId: number; name: string; value: number; expiring: number; dead: number }>();
  if (opts.showStores) {
    for (const g of groups) {
      if (g.store_id === null) continue;
      const s = stores.get(g.store_id) || { storeId: g.store_id, name: storeNames.get(g.store_id) || `Store ${g.store_id}`, value: 0, expiring: 0, dead: 0 };
      s.value += g.cost;
      if (g.bucket === 'expired' || g.bucket === 'd30') s.expiring += g.cost;
      if (g.dead) s.dead += g.cost;
      stores.set(g.store_id, s);
    }
  }
  const byStore = Array.from(stores.values()).sort((a, b) => b.value - a.value).map((s) => ({ ...s, value: r0(s.value), expiring: r0(s.expiring), dead: r0(s.dead), share: pct(s.value, total) }));

  const dead = sum((g) => g.dead);
  const expired = sum((g) => g.bucket === 'expired');
  const soon = sum((g) => g.bucket === 'd30');
  // days the stock would last at the cost of what was sold in the last 90 days; null when nothing sold
  const perDay = costOfSales90 / 90;
  const cover = perDay > 0 ? Math.round(total / perDay) : null;
  const turns = total > 0 && costOfSales90 > 0 ? Math.round(((costOfSales90 * (365 / 90)) / total) * 10) / 10 : null;

  const notes: string[] = [];
  if (expired > 0) notes.push(`${inr(expired)} of stock has expired and is still counted on the shelf (${pct(expired, total)}%). Return it, write it off or take it out.`);
  if (soon > 0) notes.push(`${inr(soon)} expires within 30 days (${pct(soon, total)}%). Ask vendors to take it back, or push it.`);
  if (dead > 0) notes.push(`${inr(dead)} (${pct(dead, total)}%) is products with no sale in the last 90 days at that store.`);
  if (cover !== null) notes.push(`At the last 90 days of sales the stock covers about ${cover} days; it turns ${turns} times a year.`);
  if (byCategory.length) notes.push(`${byCategory[0].category} holds the most: ${inr(byCategory[0].value)} (${byCategory[0].share}%).`);

  return {
    total: r0(total), totalMrp: r0(totalMrp), batches, ladder, byCategory: byCategory.slice(0, 15), moreCategories: Math.max(0, byCategory.length - 15), byStore,
    dead: { value: r0(dead), share: pct(dead, total) }, expired: r0(expired), expiring30: r0(soon),
    cover: { days: cover, turns }, notes,
  };
}
