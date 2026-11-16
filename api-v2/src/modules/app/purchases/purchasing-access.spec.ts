import { PURCHASING_ACTIONS, canDoPurchasing, isSensitivePurchasingAction } from './purchasing-access';

const perms = (...actions: string[]) => [{ resource: 'purchases', policies: actions.map((action) => ({ action })) }];

describe('who may do the sensitive purchasing actions', () => {
  it('gives the owner roles and the platform admin every action, whatever their saved permissions say', () => {
    ['Business Head', 'Owner-operator', 'Site Admin'].forEach((role) => PURCHASING_ACTIONS.forEach((a) => expect(canDoPurchasing(role, [], a)).toBe(true)));
  });

  it('gives everyone else only what is granted', () => {
    const p = perms('add', 'edit', 'payments.record');
    expect(canDoPurchasing('Purchase Staff', p, 'payments.record')).toBe(true);
    expect(canDoPurchasing('Purchase Staff', p, 'payments.reverse')).toBe(false);
    expect(canDoPurchasing('Purchase Staff', p, 'invoices.editcompleted')).toBe(false);
  });

  it('does not let the everyday add or edit actions stand in for a sensitive one', () => {
    PURCHASING_ACTIONS.forEach((a) => expect(canDoPurchasing('Purchase Staff', perms('read', 'add', 'edit', 'delete'), a)).toBe(false));
  });

  it('does not let a Store Head in by name: the grant decides', () => {
    expect(canDoPurchasing('Store Head', [], 'payments.reverse')).toBe(false);
    expect(canDoPurchasing('Store Head', perms('payments.reverse'), 'payments.reverse')).toBe(true);
  });

  it('knows which actions are the sensitive ones', () => {
    expect(isSensitivePurchasingAction('payments.record')).toBe(true);
    expect(isSensitivePurchasingAction('add')).toBe(false);
    expect(isSensitivePurchasingAction('vendors.edit')).toBe(false);
  });
});
