import { HUB, showFigure, trendOf, visibleHub } from './reports-hub';

describe('the reports hub', () => {
  const holding = (granted: string[]) => ({ has: (...k: string[]) => k.some((x) => granted.includes(x)) });

  it('shows everything to a role that holds everything, and nothing to one that holds nothing', () => {
    expect(visibleHub({ has: () => true }).length).toBe(HUB.length);
    expect(visibleHub({ has: () => false })).toEqual([]);
  });

  it('judges a card by its actions, so a role holding a few of them sees only those cards', () => {
    const groups = visibleHub(holding(['refills.view']));
    expect(groups.map((g) => g.key)).toEqual(['customers']);
    expect(groups[0].cards.map((c) => c.id)).toEqual(['rh-refills', 'rh-followups']);
  });

  it('keeps purchasing and money cards from counter staff', () => {
    const counter = ['sales', 'customers.read', 'refills.view', 'grievances.view', 'store.read', 'customers.dues.view'];
    const ids = visibleHub(holding(counter)).reduce((a: string[], g) => a.concat(g.cards.map((c) => c.id)), []);
    expect(ids).toEqual(jasmine.arrayContaining(['rh-sale-list', 'rh-refills', 'rh-stock']));
    ['rh-invoices', 'rh-payables', 'rh-vendor-returns', 'rh-gst-recon', 'rh-financials', 'rh-expenses', 'rh-gst', 'rh-finance'].forEach((id) => expect(ids).not.toContain(id));
  });

  it('tells the Reports pages apart by action', () => {
    const groups = visibleHub(holding(['reports.ask']));
    expect(groups[0].cards.map((c) => c.id)).toEqual(['rh-ask']);
  });

  it('has unique card ids, secure routes, a question for every group, and actions on every card', () => {
    const ids = HUB.reduce((a: string[], g) => a.concat(g.cards.map((c) => c.id)), []);
    expect(new Set(ids).size).toBe(ids.length);
    HUB.forEach((g) => { expect(g.question).toBeTruthy(); g.cards.forEach((c) => { expect(c.route.startsWith('/secure/')).toBe(true); expect(c.needs.length).toBeGreaterThan(0); }); });
  });
});

describe('the figures on a card', () => {
  it('shows rupees in the Indian grouping, per cents, plain numbers, text, and a dash for nothing', () => {
    expect(showFigure({ key: 'a', label: 'a', kind: 'money', value: 1234567.4 })).toBe('Rs 12,34,567');
    expect(showFigure({ key: 'a', label: 'a', kind: 'percent', value: 61.6 })).toBe('62%');
    expect(showFigure({ key: 'a', label: 'a', kind: 'number', value: 42 })).toBe('42');
    expect(showFigure({ key: 'a', label: 'a', kind: 'text', value: 'Asha' })).toBe('Asha');
    expect(showFigure({ key: 'a', label: 'a', kind: 'percent', value: null })).toBe('-');
  });

  it('says up, down or the same against the period before, and copes with nothing before', () => {
    const f = (value: number, prev?: number | null) => ({ key: 'a', label: 'a', kind: 'money' as const, value, prev });
    expect(trendOf(f(120, 100))).toEqual({ text: '+20%', dir: 'up' });
    expect(trendOf(f(80, 100))).toEqual({ text: '-20%', dir: 'down' });
    expect(trendOf(f(100, 100))!.dir).toBe('flat');
    expect(trendOf(f(50, 0))!.dir).toBe('up');
    expect(trendOf(f(50))).toBeNull();
  });
});
