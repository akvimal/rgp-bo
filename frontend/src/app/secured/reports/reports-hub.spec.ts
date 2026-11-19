import { HUB, visibleHub } from './reports-hub';

describe('the reports hub', () => {
  const all = { canOpen: () => true, has: () => true };
  const none = { canOpen: () => false, has: () => false };

  it('shows everything to a role that may open everything, and nothing to one that may open nothing', () => {
    expect(visibleHub(all).length).toBe(HUB.length);
    expect(visibleHub(none)).toEqual([]);
  });

  it('leaves out a group whose pages the role may not open', () => {
    const groups = visibleHub({ canOpen: (u) => u.startsWith('/secure/quality/refills'), has: () => false });
    expect(groups.map((g) => g.key)).toEqual(['customers']);
    expect(groups[0].cards.map((c) => c.id)).toEqual(['rh-refills']);
  });

  it('tells the three Reports pages apart by action, not by path', () => {
    const groups = visibleHub({ canOpen: () => false, has: (k) => k === 'reports.ask' });
    expect(groups[0].cards.map((c) => c.id)).toEqual(['rh-ask']);
  });

  it('has unique card ids, secure routes, and a question for every group', () => {
    const ids = HUB.reduce((a: string[], g) => a.concat(g.cards.map((c) => c.id)), []);
    expect(new Set(ids).size).toBe(ids.length);
    HUB.forEach((g) => { expect(g.question).toBeTruthy(); g.cards.forEach((c) => expect(c.route.startsWith('/secure/')).toBe(true)); });
  });
});
