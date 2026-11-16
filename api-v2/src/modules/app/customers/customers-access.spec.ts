import { CUSTOMER_ACTIONS, canDoCustomers } from './customers-access';

const perms = (...actions: string[]) => [{ resource: 'customers', policies: actions.map((action) => ({ action })) }];

describe('who may do the sensitive customer actions', () => {
  it('gives the owner roles every action by name, whatever their saved permissions say', () => {
    ['Business Head', 'Owner-operator'].forEach((role) => CUSTOMER_ACTIONS.forEach((a) => expect(canDoCustomers(role, [], a)).toBe(true)));
  });

  it('gives everyone else, the Store Head too, only what is granted', () => {
    CUSTOMER_ACTIONS.forEach((a) => expect(canDoCustomers('Store Head', [], a)).toBe(false));
    const p = perms('read', 'creditlimit.set', 'households.manage');
    expect(canDoCustomers('Store Head', p, 'creditlimit.set')).toBe(true);
    expect(canDoCustomers('Store Head', p, 'households.manage')).toBe(true);
    expect(canDoCustomers('Store Head', p, 'merge')).toBe(false);
    expect(canDoCustomers('Store Head', p, 'credit.correct')).toBe(false);
  });

  it('does not let read, reveal or export stand in for a sensitive action', () => {
    CUSTOMER_ACTIONS.forEach((a) => expect(canDoCustomers('Sales Staff', perms('read', 'reveal', 'export'), a)).toBe(false));
  });

  it('reads the actions from the customers permission only', () => {
    expect(canDoCustomers('Store Head', [{ resource: 'sales', policies: [{ action: 'merge' }] }], 'merge')).toBe(false);
  });
});
