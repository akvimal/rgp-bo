import { financeDigest } from './finance-digest';

const base = {
  health: { score: 72, status: 'act', counts: { critical: 1, major: 2, minor: 3, info: 0 }, fixFirst: [{ title: 'Drug licence expired', severity: 'critical' }, { title: 'Cash short', severity: 'major', amount: 4500, store: 'Main' }], newThisWeek: 2, lastWeekScore: 80 },
  month: { label: 'October 2026', sales: 1250000, runningCost: 210000, runningPct: 16.8, profit: 95000, salesChange: 4.25 },
  stock: { total: 800000, expired: 12000, expiring30: 30000, dead: 90000 },
  costFlags: ['Premises is 9% of sales, above its usual 6% to 8%.'],
};

describe('weekly money and health digest', () => {
  it('leads with the status, the change from last week and the counts', () => {
    const d = financeDigest(base);
    expect(d.body).toContain('Health: Act now (72/100, down 8 from last week)');
    expect(d.body).toContain('1 critical, 2 major, 3 minor; 2 new this week');
  });
  it('lists the fix-first items with store and money', () => {
    const d = financeDigest(base);
    expect(d.body).toContain('1. Drug licence expired [critical]');
    expect(d.body).toContain('2. Cash short (Main), Rs 4,500 [major]');
  });
  it('gives the month, with profit only when it is in the facts', () => {
    expect(financeDigest(base).body).toContain('Estimated profit Rs 95,000');
    expect(financeDigest(base).body).toContain('+4.3% on the month before');
    expect(financeDigest({ ...base, month: { ...base.month, profit: null } }).body).not.toContain('profit');
  });
  it('names the costs above usual and the stock problems', () => {
    const b = financeDigest(base).body;
    expect(b).toContain('- Premises is 9% of sales');
    expect(b).toContain('Rs 12,000 expired');
    expect(b).toContain('Rs 90,000 with no sale in 90 days');
  });
  it('says so when nothing needs fixing and there is no month yet', () => {
    const d = financeDigest({ ...base, health: { ...base.health, fixFirst: [], lastWeekScore: null }, month: null, stock: null, costFlags: [] });
    expect(d.body).toContain('Nothing needs fixing first.');
    expect(d.body).not.toContain('(before GST)');
    expect(d.body).toContain('(72/100)');
  });
  it('makes the same text as HTML and escapes it', () => {
    const d = financeDigest({ ...base, businessName: 'A & B <Pharmacy>' });
    expect(d.html).toContain('A &amp; B &lt;Pharmacy&gt;');
    expect(d.html).toContain('<p>Health: Act now');
  });
});
