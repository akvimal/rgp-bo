import { OWNER_ONLY_WIDGETS, viewForRole, widgetsFor, WIDGETS } from './dashboard-view';

describe('dashboard views', () => {
  it('maps each built-in role to its view', () => {
    expect(viewForRole('Business Head')).toBe('owner');
    expect(viewForRole('Owner-operator')).toBe('owner');
    expect(viewForRole('Store Head')).toBe('manager');
    expect(viewForRole('Sales Staff')).toBe('staff');
    expect(viewForRole('Counter')).toBe('counter');
    expect(viewForRole('Personal')).toBe('personal');
    expect(viewForRole('Site Admin')).toBe('platform');
  });
  it('gives a custom role the manager view, never the owner view', () => {
    expect(viewForRole('Shift Lead')).toBe('manager');
    expect(viewForRole(null)).toBe('manager');
  });
  it('keeps owner-only widgets out of every other view', () => {
    for (const v of ['manager', 'staff', 'counter', 'personal', 'platform'] as const) {
      expect(widgetsFor(v).filter((w) => OWNER_ONLY_WIDGETS.includes(w))).toEqual([]);
    }
  });
  it('starts every working view with the needs-you-now strip', () => {
    for (const v of ['owner', 'manager', 'staff', 'counter', 'personal'] as const) expect(WIDGETS[v][0]).toBe('needs');
  });
  it('returns a copy so a caller cannot change the registry', () => {
    widgetsFor('owner').push('x');
    expect(WIDGETS.owner).not.toContain('x');
  });
});
