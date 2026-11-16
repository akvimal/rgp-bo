import { SALES_ACTIONS, canDoSales } from './sales-access';

const perms = (...actions: string[]) => [{ resource: 'sales', policies: actions.map((action) => ({ action })) }];

describe('who may do the till overrides', () => {
  it('gives the owner roles every action by name, whatever their saved permissions say', () => {
    ['Business Head', 'Owner-operator'].forEach((role) => SALES_ACTIONS.forEach((a) => expect(canDoSales(role, [], a)).toBe(true)));
  });

  it('gives everyone else, the Store Head too, only what is granted', () => {
    SALES_ACTIONS.forEach((a) => expect(canDoSales('Store Head', [], a)).toBe(false));
    const p = perms('add', 'bill', 'batchstop.override');
    expect(canDoSales('Store Head', p, 'batchstop.override')).toBe(true);
    expect(canDoSales('Store Head', p, 'creditlimit.override')).toBe(false);
    expect(canDoSales('Store Head', p, 'deliveries.manage')).toBe(false);
  });

  it('does not let billing, void or force void stand in for an override', () => {
    SALES_ACTIONS.forEach((a) => expect(canDoSales('Sales Staff', perms('read', 'view', 'add', 'bill', 'void', 'forcevoid'), a)).toBe(false));
  });

  it('reads the actions from the sales permission only', () => {
    expect(canDoSales('Store Head', [{ resource: 'customers', policies: [{ action: 'creditlimit.override' }] }], 'creditlimit.override')).toBe(false);
  });
});
