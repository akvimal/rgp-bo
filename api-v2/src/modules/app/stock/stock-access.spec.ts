import 'reflect-metadata';
import { PERMISSION_KEY } from 'src/core/decorator/permission.decorator';
import { STOCK_ACTIONS, STOCK_PERMISSION_PREFIX, canDoStock, isStockAction } from './stock-access';
import { StockController } from './stock.controller';
import { StoreStockTransferController } from './store-stock-transfer.controller';

const perms = (...actions: string[]) => [{ resource: 'store', policies: actions.map((action) => ({ action })) }];

/** the @Permission value of every handler of a controller that has one */
function permissionsOf(controller: any): string[] {
  const proto = controller.prototype;
  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor')
    .map((n) => Reflect.getMetadata(PERMISSION_KEY, proto[n]))
    .filter((p) => typeof p === 'string');
}

describe('who may change stock, count it and move it', () => {
  it('has no route left on the old all-in-one auditStock gate', () => {
    [StockController, StoreStockTransferController].forEach((c) => expect(permissionsOf(c)).not.toContain('auditStock'));
  });

  it('uses every stock action in some route, and only known ones', () => {
    const used = [...permissionsOf(StockController), ...permissionsOf(StoreStockTransferController)]
      .filter((p) => p.startsWith(STOCK_PERMISSION_PREFIX)).map((p) => p.slice(STOCK_PERMISSION_PREFIX.length));
    used.forEach((a) => expect(isStockAction(a)).toBe(true));
    STOCK_ACTIONS.forEach((a) => expect(used).toContain(a));
  });

  it('gives the owner roles every action by name, whatever their saved permissions say', () => {
    ['Business Head', 'Owner-operator'].forEach((role) => STOCK_ACTIONS.forEach((a) => expect(canDoStock(role, [], a)).toBe(true)));
  });

  it('gives everyone else, the Store Head too, only what is granted', () => {
    expect(canDoStock('Store Head', [], 'qty.adjust')).toBe(false);
    const p = perms('count.perform', 'transfer.request');
    expect(canDoStock('Store Head', p, 'count.perform')).toBe(true);
    expect(canDoStock('Store Head', p, 'transfer.receive')).toBe(false);
    expect(canDoStock('Store Head', p, 'audit.approve')).toBe(false);
  });

  it('does not let the old store adjust or the stock adjust and audit boxes stand in for the new actions', () => {
    STOCK_ACTIONS.forEach((a) => {
      expect(canDoStock('Sales Staff', perms('adjust', 'read'), a)).toBe(false);
      expect(canDoStock('Sales Staff', [{ resource: 'stock', policies: [{ action: 'adjust' }, { action: 'audit' }] }], a)).toBe(false);
    });
  });
});
