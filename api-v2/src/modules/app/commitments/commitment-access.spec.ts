import { canManageCustomerOrders, canUseCustomerOrders } from './commitment-access';

const perm = (...actions: string[]) => [{ resource: 'customerorders', policies: actions.map((action) => ({ action })) }];

describe('who may use customer orders', () => {
  it('lets the owner roles in whatever their saved permissions say', () => {
    expect(canUseCustomerOrders('Business Head', [])).toBe(true);
    expect(canUseCustomerOrders('Owner-operator', [])).toBe(true);
    expect(canManageCustomerOrders('Business Head', [])).toBe(true);
  });

  it('needs the grant for everyone else, a store head included', () => {
    expect(canUseCustomerOrders('Store Head', [])).toBe(false);
    expect(canUseCustomerOrders('Sales Staff', [])).toBe(false);
    expect(canManageCustomerOrders('Store Head', [])).toBe(false);
  });

  it('view opens the page and the till work but not the manager actions', () => {
    expect(canUseCustomerOrders('Sales Staff', perm('view'))).toBe(true);
    expect(canManageCustomerOrders('Sales Staff', perm('view'))).toBe(false);
  });

  it('manage carries the manager actions, and counts as being able to use the page', () => {
    expect(canManageCustomerOrders('Store Head', perm('view', 'manage'))).toBe(true);
    expect(canUseCustomerOrders('Custom role', perm('manage'))).toBe(true);
  });

  it('being able to sell is not enough (the old behaviour rode on sales)', () => {
    const sales = [{ resource: 'sales', policies: [{ action: 'add' }, { action: 'read' }] }];
    expect(canUseCustomerOrders('Sales Staff', sales)).toBe(false);
  });
});
