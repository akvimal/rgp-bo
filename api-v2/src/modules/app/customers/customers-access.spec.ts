import { CUSTOMER_ACTIONS, canDoCustomers } from './customers-access';
import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CustomerDueController } from './customer-due.controller';
import { CustomerRelationshipController } from './customer-relationship.controller';
import { META_KEY, worksTheTill } from './customer-action.guard';

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


/** the routes of a controller that have no @NeedsCustomers action */
function unguarded(controller: any): string[] {
  const proto = controller.prototype;
  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor' && Reflect.getMetadata(METHOD_METADATA, proto[n]) !== undefined && !Reflect.getMetadata(META_KEY, proto[n]))
    .map((n) => `${controller.name}.${n} (${Reflect.getMetadata(PATH_METADATA, proto[n])})`);
}

describe('the day-to-day customer routes', () => {
  it('names an action for every route of the dues and relationship controllers, so none is left open to any login', () => {
    expect([...unguarded(CustomerDueController), ...unguarded(CustomerRelationshipController)]).toEqual([]);
  });

  it('gives the owner roles the five new actions by name, and everyone else only the grant', () => {
    ['dues.view', 'dues.collect', 'audiences.use', 'worklist.use', 'consent.manage'].forEach((a) => {
      expect(canDoCustomers('Business Head', [], a as any)).toBe(true);
      expect(canDoCustomers('Store Head', [], a as any)).toBe(false);
      expect(canDoCustomers('Accountant', perms(a), a as any)).toBe(true);
      expect(canDoCustomers('Accountant', perms('read'), a as any)).toBe(false);
    });
  });

  it('knows a role that works the till (it may add or bill a sale)', () => {
    expect(worksTheTill([{ resource: 'sales', policies: [{ action: 'add' }] }])).toBe(true);
    expect(worksTheTill([{ resource: 'sales', policies: [{ action: 'bill' }] }])).toBe(true);
    expect(worksTheTill([{ resource: 'sales', policies: [{ action: 'read' }] }])).toBe(false);
    expect(worksTheTill([{ resource: 'customers', policies: [{ action: 'add' }] }])).toBe(false);
  });
});
