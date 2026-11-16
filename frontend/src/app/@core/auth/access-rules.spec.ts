import { availabilityOf, pageRuleDecides, PageContext, Plan, resourceAvailableFor } from './access-rules';

const plan = (over: Partial<Plan> & { off?: string[] } = {}): Plan => ({
  hosted: false,
  purchasingFull: true,
  feedbackOn: true,
  moduleOn: (k) => !(over.off || []).includes(k),
  ...over,
});

describe('which permission groups an account is offered', () => {
  it('offers everything when every module is on', () => {
    ['hr', 'myhr', 'purchases', 'purchaseorders', 'expenses', 'paymentrecon', 'stockaudit', 'refills', 'scheduleregister', 'feedback', 'gst', 'sales', 'customers', 'businesses'].forEach((k) => expect(resourceAvailableFor(k, plan())).toBeTrue());
  });

  it('hides the HR groups when HR is off, and no others', () => {
    const p = plan({ off: ['hr'] });
    ['hr', 'myhr', 'leaveapprove', 'attendpunch', 'attendreview', 'kpirate', 'mykpi'].forEach((k) => expect(resourceAvailableFor(k, p)).toBeFalse());
    ['purchases', 'sales', 'expenses', 'gst'].forEach((k) => expect(resourceAvailableFor(k, p)).toBeTrue());
  });

  it('follows each module for the resources that depend on it', () => {
    expect(resourceAvailableFor('purchases', plan({ off: ['purchasing'] }))).toBeFalse();
    expect(resourceAvailableFor('vendorissues', plan({ off: ['purchasing'] }))).toBeFalse();
    expect(resourceAvailableFor('expenses', plan({ off: ['expenses'] }))).toBeFalse();
    expect(resourceAvailableFor('paymentrecon', plan({ off: ['payment_recon'] }))).toBeFalse();
    expect(resourceAvailableFor('stockaudit', plan({ off: ['stock_audits'] }))).toBeFalse();
    expect(resourceAvailableFor('refills', plan({ off: ['refills'] }))).toBeFalse();
    expect(resourceAvailableFor('scheduleregister', plan({ off: ['drug_register'] }))).toBeFalse();
    expect(resourceAvailableFor('gst', plan({ off: ['gst'] }))).toBeFalse();
  });

  it('takes purchase orders away with simple purchasing, but not purchases', () => {
    const simple = plan({ purchasingFull: false });
    expect(resourceAvailableFor('purchaseorders', simple)).toBeFalse();
    expect(resourceAvailableFor('purchases', simple)).toBeTrue();
  });

  it('offers Help and feedback only when the business switched it on, and Businesses only off the hosted platform', () => {
    expect(resourceAvailableFor('feedback', plan({ feedbackOn: false }))).toBeFalse();
    expect(resourceAvailableFor('businesses', plan({ hosted: true }))).toBeFalse();
  });

  it('knows the module of a resource from the registry', () => {
    expect(availabilityOf('hr')).toBe('hr');
    expect(availabilityOf('purchaseorders')).toBe('purchasing_full');
    expect(availabilityOf('sales')).toBeUndefined();
  });
});

describe('the pages that are a rule, not a path some role carries', () => {
  const ctx = (granted: string[] = [], packs: string[] = []): PageContext => ({ has: (k) => granted.includes(k), packOn: (p) => packs.includes(p) });

  it('are open to everyone signed in for notifications, the app guide, help and the knowledge check', () => {
    ['/secure/notifications', '/secure/app-guide', '/secure/help', '/secure/help/anything', '/secure/knowledge'].forEach((u) => expect(pageRuleDecides(u, ctx())).toBeTrue());
  });

  it('match the page itself, not look-alikes or what is under an exact page', () => {
    expect(pageRuleDecides('/secure/notifications/x', ctx())).toBeNull();
    expect(pageRuleDecides('/secure/app-guide/x', ctx())).toBeNull();
    expect(pageRuleDecides('/secure/helpful', ctx())).toBeNull();
  });

  it('open the financial dashboard for finance.view or expenses.approve only', () => {
    expect(pageRuleDecides('/secure/financials', ctx())).toBeFalse();
    expect(pageRuleDecides('/secure/financials', ctx(['finance.view']))).toBeTrue();
    expect(pageRuleDecides('/secure/financials', ctx(['expenses.approve']))).toBeTrue();
  });

  it('open the pharmacy guide in a pharmacy business only', () => {
    expect(pageRuleDecides('/secure/pharmacy-guide', ctx())).toBeFalse();
    expect(pageRuleDecides('/secure/pharmacy-guide', ctx([], ['pharmacy']))).toBeTrue();
  });

  it('leave every other page to the role\'s own paths (Customer orders is one of them now)', () => {
    expect(pageRuleDecides('/secure/commitments', ctx(['sales']))).toBeNull();
    expect(pageRuleDecides('/secure/sales/pos', ctx())).toBeNull();
  });
});
