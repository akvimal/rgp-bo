import { AUDIENCES, CustomerFacts, classify, collapseByNumber, contactable, dueLimit, quintile } from './customer-relationship-rules';

const facts = (id: number, over: Partial<CustomerFacts> = {}): CustomerFacts => ({
  id, visitsAll: 0, visits12: 0, spend12: 0, daysSinceLast: null, daysSinceFirst: null, daysSinceCreated: 10, usualGap: null, credit: 0, ...over,
});

describe('quintile', () => {
  it('scores by the share of the base beaten, ties sharing a score', () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quintile(10, all)).toBe(5);
    expect(quintile(1, all)).toBe(1);
    expect(quintile(1, [1, 1, 1, 1])).toBe(1);
  });
  it('scores recency the other way round: fewer days is better', () => {
    expect(quintile(2, [2, 30, 60, 90, 120], false)).toBe(5);
    expect(quintile(120, [2, 30, 60, 90, 120], false)).toBe(1);
  });
});

describe('classify', () => {
  it('derives inactive from the last visit, and a returning customer is active again', () => {
    const rows = [facts(1, { visitsAll: 4, visits12: 0, daysSinceLast: 400, daysSinceFirst: 900 }), facts(2, { visitsAll: 5, visits12: 2, daysSinceLast: 20, daysSinceFirst: 900, spend12: 500 })];
    const p = classify(rows, 365);
    expect(p.get(1)!.status).toBe('inactive');
    expect(p.get(1)!.segment).toBe('Lapsed');
    expect(p.get(2)!.status).toBe('active');
  });

  it('keeps a customer with store credit active, however long ago they came', () => {
    const p = classify([facts(1, { visitsAll: 2, daysSinceLast: 800, daysSinceFirst: 900, credit: 150 })], 365);
    expect(p.get(1)!.status).toBe('active');
    expect(p.get(1)!.segment).toBe('Lapsed');
  });

  it('treats a customer with no bills as active until the period passes since they were added', () => {
    const p = classify([facts(1, { daysSinceCreated: 20 }), facts(2, { daysSinceCreated: 500 })], 365);
    expect(p.get(1)!.status).toBe('active');
    expect(p.get(2)!.status).toBe('inactive');
    expect(p.get(1)!.segment).toBe('No purchases');
  });

  it('marks a steady buyer past their usual gap as due back, then at risk when much later', () => {
    const base = { visitsAll: 10, visits12: 10, spend12: 5000, daysSinceFirst: 600, usualGap: 30 };
    const p = classify([facts(1, { ...base, daysSinceLast: 20 }), facts(2, { ...base, daysSinceLast: 38 }), facts(3, { ...base, daysSinceLast: dueLimit(30) + 5 })], 365);
    expect(p.get(1)!.dueBack).toBe(false);
    expect(p.get(2)!.dueBack).toBe(true);
    expect(p.get(2)!.reason).toContain('due back');
    expect(p.get(3)!.dueBack).toBe(false);
    expect(p.get(3)!.segment).toBe('At risk');
  });

  it('stops calling a customer new once they have three visits, even if the first bill was recent', () => {
    const p = classify([facts(1, { visitsAll: 8, visits12: 8, spend12: 4000, daysSinceLast: 5, daysSinceFirst: 80 })], 365);
    expect(p.get(1)!.segment).not.toBe('New');
  });

  it('calls a recent first-time buyer new, and puts the best of a larger base in Champions with a Gold tier', () => {
    const rows: CustomerFacts[] = [facts(100, { visitsAll: 1, visits12: 1, spend12: 300, daysSinceLast: 15, daysSinceFirst: 15 })];
    for (let i = 1; i <= 20; i++) rows.push(facts(i, { visitsAll: i, visits12: i, spend12: i * 1000, daysSinceLast: 40 - i, daysSinceFirst: 700 }));
    const p = classify(rows, 365);
    expect(p.get(100)!.segment).toBe('New');
    expect(p.get(20)!.segment).toBe('Champions');
    expect(p.get(20)!.tier).toBe('Gold');
    expect(p.get(1)!.tier).not.toBe('Gold');
  });
});

describe('audiences and consent', () => {
  it('needs a recorded yes for promotional audiences but only the absence of a no for service ones', () => {
    const c = (consent: string | null, doNotContact = false) => ({ mobile: '9876543210', doNotContact, consent });
    expect(contactable(c(null), true).ok).toBe(false);
    expect(contactable(c('YES'), true).ok).toBe(true);
    expect(contactable(c(null), false).ok).toBe(true);
    expect(contactable(c('NO'), false).ok).toBe(false);
    expect(contactable(c('YES', true), true).ok).toBe(false);
    expect(contactable({ mobile: '0000000000', doNotContact: false, consent: 'YES' }, true).ok).toBe(false);
  });

  it('has due back and new-second-visit as service audiences and the rest promotional', () => {
    expect(AUDIENCES.filter((a) => !a.promo).map((a) => a.key)).toEqual(['due_back', 'new_second_visit']);
  });
});

describe('one message per number', () => {
  it('lists people who share a mobile once, the first of them, and says who else is on it', () => {
    const out = collapseByNumber([
      { name: 'Rama Devi', mobile: '9876543210' }, { name: 'Anil', mobile: '9123456780' }, { name: 'Rama Krishnan', mobile: '9876543210' }, { name: 'Sita', mobile: '9876543210' },
    ]);
    expect(out.map((o) => o.name)).toEqual(['Rama Devi', 'Anil']);
    expect(out[0].alsoOnNumber).toEqual(['Rama Krishnan', 'Sita']);
    expect(out[1].alsoOnNumber).toEqual([]);
  });
  it('never merges people with no number', () => {
    const out = collapseByNumber([{ name: 'A', mobile: null }, { name: 'B', mobile: null }]);
    expect(out.length).toBe(2);
  });
  it('keeps the order it was given', () => {
    expect(collapseByNumber([{ name: 'Z', mobile: '9111111111' }, { name: 'A', mobile: '9222222222' }]).map((o) => o.name)).toEqual(['Z', 'A']);
  });
});
