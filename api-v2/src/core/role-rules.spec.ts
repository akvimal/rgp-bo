import { grants, mergeStores, overreach, permsOf, roleBlock, sharesStore } from './role-rules';

const perm = (resource: string, ...actions: string[]) => ({ resource, policies: actions.map((action) => ({ action })) });

describe('what a role may hold', () => {
  const manager = [perm('sales', 'read', 'add'), perm('users', 'read', 'add')];
  it('a manager can only give what they hold themselves', () => {
    expect(overreach('Store Head', manager, [perm('sales', 'read')])).toEqual([]);
    expect(overreach('Store Head', manager, [perm('sales', 'read', 'bill'), perm('finance', 'view')])).toEqual(['sales.bill', 'finance.view']);
  });
  it('an owner may give anything except what only the platform holds; the platform admin anything', () => {
    expect(overreach('Business Head', [], [perm('finance', 'view'), perm('purchases', 'request')])).toEqual([]);
    expect(overreach('Owner-operator', [], [perm('businesses', 'manage')])).toEqual(['businesses']);
    expect(overreach('Site Admin', [], [perm('businesses', 'manage')])).toEqual([]);
  });
  it('reads permissions stored as an array or as text, and nothing else', () => {
    expect(permsOf({ permissions: [perm('a', 'x')] })).toHaveLength(1);
    expect(permsOf({ permissions: JSON.stringify([perm('a', 'x')]) })).toHaveLength(1);
    expect(permsOf({ permissions: 'not json' })).toEqual([]);
    expect(permsOf(null)).toEqual([]);
    expect(grants(permsOf({ permissions: [perm('a', 'x')] }), 'a', 'x')).toBe(true);
    expect(grants([], 'a', 'x')).toBe(false);
  });
});

describe('who may be given which role', () => {
  it('nobody gives the owner or admin roles from here', () => {
    for (const giver of ['Business Head', 'Store Head', 'Site Admin']) {
      expect(roleBlock(giver, 'Business Head', true)).toContain('platform administrator');
      expect(roleBlock(giver, 'Owner-operator', true)).toContain('platform administrator');
    }
  });
  it('an owner gives any other role, built in or their own', () => {
    for (const r of ['Store Head', 'Sales Staff', 'Counter', 'Personal']) expect(roleBlock('Business Head', r, true)).toBeNull();
    expect(roleBlock('Business Head', 'Accountant', false)).toBeNull();
  });
  it('a manager gives the lower built-in roles and the owner-built ones, never a manager role', () => {
    for (const r of ['Sales Staff', 'Counter', 'Personal']) expect(roleBlock('Store Head', r, true)).toBeNull();
    expect(roleBlock('Store Head', 'Purchase Staff', false)).toBeNull();
    expect(roleBlock('Store Head', 'Store Head', true)).toContain('manager');
  });
});

describe('a manager changing the stores of a person', () => {
  it('only their own stores are touched; the person keeps any store outside them', () => {
    expect(mergeStores([1, 2, 9], [1, 2], [2])).toEqual([2, 9]);
    expect(mergeStores([1], [1, 2], [])).toEqual([]);
    expect(mergeStores([9], [1, 2], [1])).toEqual([1, 9]);
  });
  it('sharing a store', () => {
    expect(sharesStore([1, 2], [2, 3])).toBe(true);
    expect(sharesStore([1], [2])).toBe(false);
    expect(sharesStore([], [2])).toBe(false);
  });
});
