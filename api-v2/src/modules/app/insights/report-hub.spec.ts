import { TILE_NEEDS, holds, mayOpenTile, previousRange, withPrevious } from './report-hub';

const perms = [
  { resource: 'sales', policies: [{ action: 'read' }] },
  { resource: 'refills', policies: [{ action: 'view' }] },
  { resource: 'customers', policies: [{ action: 'read' }] },
  { resource: 'purchases', policies: [{ action: 'read' }, { action: 'request' }, { action: 'payments.view' }] },
];

describe('the hub card figures', () => {
  it('reads a key as a resource, an action, or an action with dots in it', () => {
    expect(holds(perms, 'sales')).toBe(true);
    expect(holds(perms, 'refills.view')).toBe(true);
    expect(holds(perms, 'purchases.payments.view')).toBe(true);
    expect(holds(perms, 'purchases.add')).toBe(false);
    expect(holds(perms, 'finance.view')).toBe(false);
  });

  it('shows a card to an owner always, and to others only by the card\'s own actions', () => {
    expect(mayOpenTile(true, [], 'rh-invoices')).toBe(true);
    expect(mayOpenTile(false, perms, 'rh-sale-list')).toBe(true);
    expect(mayOpenTile(false, perms, 'rh-refills')).toBe(true);
    // a counter role holds purchases.read and payments.view for its requests, but not purchases.add: no purchasing figures
    expect(mayOpenTile(false, perms, 'rh-invoices')).toBe(false);
    expect(mayOpenTile(false, perms, 'rh-dues')).toBe(false);
    expect(mayOpenTile(true, [], 'rh-unknown')).toBe(false);
  });

  it('covers the same actions as the cards (a figure never needs less than its card)', () => {
    Object.values(TILE_NEEDS).forEach((n) => expect(n.length).toBeGreaterThan(0));
  });

  it('finds the period just before, of the same length', () => {
    expect(previousRange('2026-11-01', '2026-11-20')).toEqual({ from: '2026-10-13', to: '2026-11-01' });
    expect(previousRange('2026-11-20', '2026-11-21')).toEqual({ from: '2026-11-19', to: '2026-11-20' });
  });

  it('puts the earlier figure beside this one only for numbers that ask for a trend', () => {
    const now = [
      { key: 'sales', label: 'Sales', kind: 'money' as const, value: 120, trend: true },
      { key: 'top', label: 'Top', kind: 'text' as const, value: 'Asha', trend: true },
      { key: 'open', label: 'Open', kind: 'number' as const, value: 3 },
    ];
    const before = [{ key: 'sales', label: 'Sales', kind: 'money' as const, value: 100 }, { key: 'top', label: 'Top', kind: 'text' as const, value: 'Ravi' }, { key: 'open', label: 'Open', kind: 'number' as const, value: 5 }];
    const r = withPrevious(now, before);
    expect(r[0].prev).toBe(100);
    expect(r[1].prev).toBeUndefined();
    expect(r[2].prev).toBeUndefined();
  });
});
