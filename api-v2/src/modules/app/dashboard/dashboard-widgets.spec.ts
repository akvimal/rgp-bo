import { WIDGETS, widgetsFor } from './dashboard-view';
import { FINANCE_PAGE_ORDER, WIDGET_DEFS, financePageFor, financeWidgetsFor, registryFor, widgetDef } from './dashboard-widgets';

describe('widget contract', () => {
  it('declares every widget once, with a definition, a source and an empty text', () => {
    const keys = WIDGET_DEFS.map((w) => w.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const w of WIDGET_DEFS) {
      expect(w.definition.length).toBeGreaterThan(20);
      expect(w.source.startsWith('/dashboard/')).toBe(true);
      expect(w.empty.length).toBeGreaterThan(5);
      expect(w.views.length).toBeGreaterThan(0);
    }
  });
  it('puts the finance cards on the owner and manager views and nowhere else', () => {
    for (const v of ['staff', 'counter', 'personal', 'platform'] as const) expect(financeWidgetsFor(v)).toEqual([]);
    expect(financeWidgetsFor('owner')).toContain('gst-position');
    expect(financeWidgetsFor('manager')).not.toContain('gst-position');
    expect(financeWidgetsFor('manager')).toContain('money-matrix');
  });
  it('is part of each view list the page renders, after the older cards', () => {
    // the financial cards live on the Financial dashboard page; the dashboard holds a link (money-matrix), health and patterns
    const pageOnly = ['cost-ratios', 'cash-position', 'stock-value', 'gst-position'];
    expect(widgetsFor('owner')).toEqual(expect.arrayContaining(financeWidgetsFor('owner').filter((k) => !pageOnly.includes(k))));
    expect(widgetsFor('manager')).toEqual(expect.arrayContaining(financeWidgetsFor('manager').filter((k) => !pageOnly.includes(k))));
    for (const v of ['staff', 'counter', 'personal', 'platform'] as const) expect(widgetsFor(v).filter((k) => widgetDef(k))).toEqual([]);
    expect(WIDGETS.owner[0]).toBe('needs');
  });
  it('orders the Financial dashboard page and leaves out what a view may not see', () => {
    expect(financePageFor('owner')).toEqual(FINANCE_PAGE_ORDER);
    expect(financePageFor('manager')).toEqual(['money-matrix', 'cost-ratios', 'cash-position', 'stock-value']);
    expect(financePageFor('counter')).toEqual([]);
  });
  it('returns the definitions in the order asked and skips older cards', () => {
    expect(registryFor(['tiles', 'health', 'patterns']).map((d) => d.key)).toEqual(['health', 'patterns']);
  });
});
