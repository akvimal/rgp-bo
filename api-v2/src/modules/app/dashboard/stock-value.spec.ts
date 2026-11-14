import { bucketOf, stockValue } from './stock-value';

const g = (o: any) => ({ store_id: 1, category: 'Tablets', bucket: 'later', dead: false, cost: 0, mrp: 0, batches: 1, ...o });
const names = new Map([[1, 'Main'], [2, 'Branch']]);

describe('stock value', () => {
  it('puts a batch in its expiry bucket', () => {
    expect(bucketOf(null)).toBe('none');
    expect(bucketOf(-1)).toBe('expired');
    expect(bucketOf(0)).toBe('d30');
    expect(bucketOf(31)).toBe('d60');
    expect(bucketOf(90)).toBe('d90');
    expect(bucketOf(120)).toBe('d180');
    expect(bucketOf(400)).toBe('later');
  });

  const groups = [
    g({ cost: 1000, mrp: 1400 }),
    g({ cost: 200, mrp: 280, bucket: 'expired' }),
    g({ cost: 300, mrp: 420, bucket: 'd30', category: 'Syrups' }),
    g({ cost: 500, mrp: 700, dead: true, store_id: 2, category: 'Syrups' }),
  ];

  it('adds the value at cost and at MRP, and the ladder shares', () => {
    const s = stockValue(groups, names, 0);
    expect(s.total).toBe(2000);
    expect(s.totalMrp).toBe(2800);
    expect(s.ladder.find((l) => l.key === 'expired')!.value).toBe(200);
    expect(s.ladder.find((l) => l.key === 'd30')!.share).toBe(15);
    expect(s.expired).toBe(200);
    expect(s.expiring30).toBe(300);
  });
  it('totals dead stock and says so', () => {
    const s = stockValue(groups, names, 0);
    expect(s.dead).toEqual({ value: 500, share: 25 });
    expect(s.notes.join(' ')).toContain('no sale in the last 90 days');
  });
  it('lists categories biggest first with their expiring and dead value', () => {
    const s = stockValue(groups, names, 0);
    expect(s.byCategory[0]).toMatchObject({ category: 'Tablets', value: 1200, expiring: 200 });
    expect(s.byCategory[1]).toMatchObject({ category: 'Syrups', value: 800, expiring: 300, dead: 500 });
  });
  it('shows stores only when asked', () => {
    expect(stockValue(groups, names, 0).byStore).toEqual([]);
    const s = stockValue(groups, names, 0, { showStores: true });
    expect(s.byStore.map((x) => x.name)).toEqual(['Main', 'Branch']);
    expect(s.byStore[1]).toMatchObject({ value: 500, dead: 500 });
  });
  it('works out days of cover and turns from the cost of sales in 90 days', () => {
    const s = stockValue(groups, names, 900);
    expect(s.cover.days).toBe(200);
    expect(s.cover.turns).toBe(1.8);
    expect(stockValue(groups, names, 0).cover.days).toBeNull();
  });
  it('copes with no stock', () => {
    const s = stockValue([], names, 0);
    expect(s.total).toBe(0);
    expect(s.notes).toEqual([]);
  });
});
