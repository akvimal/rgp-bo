import { FINANCE_ACTIONS, GSTFILING_ACTIONS, canDoFinance, canDoGstFiling } from './accounts-access';

const perms = (resource: string, ...actions: string[]) => [{ resource, policies: actions.map((action) => ({ action })) }];

describe('who may do what in finance and GST filing', () => {
  it('gives the owner roles every action by name, whatever their saved permissions say', () => {
    ['Business Head', 'Owner-operator'].forEach((role) => {
      (['view', ...FINANCE_ACTIONS] as const).forEach((a) => expect(canDoFinance(role, [], a)).toBe(true));
      (['view', ...GSTFILING_ACTIONS] as const).forEach((a) => expect(canDoGstFiling(role, [], a)).toBe(true));
    });
  });

  it('keeps view as holding the resource, with or without actions listed (as before)', () => {
    expect(canDoFinance('Accountant', [{ resource: 'finance' }], 'view')).toBe(true);
    expect(canDoFinance('Accountant', perms('finance', 'view'), 'view')).toBe(true);
    expect(canDoGstFiling('Accountant', [{ resource: 'gstfiling' }], 'view')).toBe(true);
    expect(canDoFinance('Accountant', perms('gstfiling', 'view'), 'view')).toBe(false);
  });

  it('gives everyone else only the actions granted', () => {
    const p = perms('finance', 'view', 'reconcile');
    expect(canDoFinance('Accountant', p, 'reconcile')).toBe(true);
    expect(canDoFinance('Accountant', p, 'bank.import')).toBe(false);
    expect(canDoFinance('Accountant', p, 'records')).toBe(false);
  });

  it('does not let viewing stand in for preparing, exporting, locking or unlocking', () => {
    GSTFILING_ACTIONS.forEach((a) => expect(canDoGstFiling('Accountant', perms('gstfiling', 'view'), a)).toBe(false));
    expect(canDoGstFiling('Accountant', perms('gstfiling', 'view', 'lock'), 'unlock')).toBe(false);     // locking is not unlocking
  });
});
