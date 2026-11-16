import { effectiveScope, grantedScope, isGrantScope, scopeRank } from './scope-grant';
import { overreach } from './role-rules';

const perm = (resource: string, action: string, scope?: string) => [{ resource, policies: [{ action, ...(scope ? { scope } : {}) }] }];

describe('scope on the grant', () => {
  it('reads the widest explicit scope a role carries for one action, and ignores anything that is not a scope', () => {
    expect(grantedScope(perm('expenses', 'view', 'business'), 'expenses', 'view')).toBe('business');
    expect(grantedScope(perm('expenses', 'view', 'store'), 'expenses', 'view')).toBe('store');
    expect(grantedScope(perm('expenses', 'view'), 'expenses', 'view')).toBeNull();
    expect(grantedScope(perm('expenses', 'view', 'everything'), 'expenses', 'view')).toBeNull();
    expect(grantedScope(perm('expenses', 'view', 'business'), 'expenses', 'approve')).toBeNull();
    expect(grantedScope(perm('inquiries', 'view', 'business'), 'expenses', 'view')).toBeNull();
    const two = [{ resource: 'expenses', policies: [{ action: 'view', scope: 'store' }, { action: 'view', scope: 'business' }] }];
    expect(grantedScope(two, 'expenses', 'view')).toBe('business');
  });

  it('keeps the legacy scope when none is written, so no existing role changes', () => {
    expect(effectiveScope('Accountant', perm('expenses', 'view'), 'expenses', 'view', 'own')).toBe('own');
    expect(effectiveScope('Store Head', perm('expenses', 'view'), 'expenses', 'view', 'store')).toBe('store');
  });

  it('widens a role with an explicit scope, and never narrows one below the legacy scope', () => {
    expect(effectiveScope('Accountant', perm('expenses', 'view', 'business'), 'expenses', 'view', 'own')).toBe('business');
    expect(effectiveScope('Accountant', perm('expenses', 'view', 'store'), 'expenses', 'view', 'own')).toBe('store');
    expect(effectiveScope('Store Head', perm('expenses', 'view', 'store'), 'expenses', 'view', 'business')).toBe('business');
  });

  it('gives the owner roles the whole business whatever their saved permissions say', () => {
    expect(effectiveScope('Business Head', [], 'expenses', 'view', 'own')).toBe('business');
    expect(effectiveScope('Owner-operator', perm('expenses', 'view', 'store'), 'expenses', 'view', 'own')).toBe('business');
  });

  it('ranks the scopes', () => {
    expect(scopeRank('own')).toBeLessThan(scopeRank('store'));
    expect(scopeRank('store')).toBeLessThan(scopeRank('business'));
    expect(isGrantScope('business')).toBe(true);
    expect(isGrantScope('own')).toBe(false);
  });
});

describe('who may give which scope', () => {
  const holds = (scope?: string) => [{ resource: 'expenses', policies: [{ action: 'view', ...(scope ? { scope } : {}) }] }];
  const give = (scope?: string) => [{ resource: 'expenses', policies: [{ action: 'view', ...(scope ? { scope } : {}) }] }];

  it('lets an owner give any scope', () => {
    expect(overreach('Business Head', [], give('business'))).toEqual([]);
  });

  it('lets a manager give the scope they hold, and none wider', () => {
    expect(overreach('Store Head', holds(), give())).toEqual([]);
    expect(overreach('Store Head', holds(), give('store'))).toEqual([]);                     // a manager sees their stores by default
    expect(overreach('Store Head', holds(), give('business'))).toEqual(['expenses.view:business']);
    expect(overreach('Store Head', holds('business'), give('business'))).toEqual([]);
  });

  it('refuses a value that is not a scope', () => {
    expect(overreach('Store Head', holds(), give('everything'))).toEqual(['expenses.view:everything']);
  });
});
