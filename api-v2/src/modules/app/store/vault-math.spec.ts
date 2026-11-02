import { dropExceedsCount, firstShortfall, holdingsToDenoms, holdingsTotal, readRequest, reservedByPending, vaultHoldings } from './vault-math';

const mv = (direction: 'IN' | 'OUT', denominations: any[], status = 'CONFIRMED') => ({ direction, status, amount: 0, denominations });

describe('vault math', () => {
  it('adds confirmed ins and takes off confirmed outs, by face value', () => {
    const held = vaultHoldings([
      mv('IN', [{ d: 500, n: 10 }, { d: 100, n: 20 }]),
      mv('OUT', [{ d: 500, n: 4 }]),
    ]);
    expect(holdingsToDenoms(held)).toEqual([{ d: 500, n: 6 }, { d: 100, n: 20 }]);
    expect(holdingsTotal(held)).toBe(5000);
  });

  it('ignores pending and rejected movements', () => {
    const held = vaultHoldings([mv('IN', [{ d: 500, n: 10 }]), mv('IN', [{ d: 500, n: 99 }], 'PENDING'), mv('IN', [{ d: 500, n: 99 }], 'REJECTED')]);
    expect(holdingsTotal(held)).toBe(5000);
  });

  it('sets aside notes promised to pending outgoing movements', () => {
    const rows = [mv('IN', [{ d: 500, n: 10 }]), mv('OUT', [{ d: 500, n: 8 }], 'PENDING')];
    const held = vaultHoldings(rows);
    expect(firstShortfall([{ d: 500, n: 3 }], held, reservedByPending(rows))).toEqual({ d: 500, wanted: 3, available: 2 });
    expect(firstShortfall([{ d: 500, n: 2 }], held, reservedByPending(rows))).toBeNull();
  });

  it('reports a face value the vault does not hold at all', () => {
    expect(firstShortfall([{ d: 2000, n: 1 }], vaultHoldings([]))).toEqual({ d: 2000, wanted: 1, available: 0 });
  });

  it('checks a drop comes out of the drawer count', () => {
    const counted = [{ d: 500, n: 10 }, { d: 100, n: 5 }];
    expect(dropExceedsCount([{ d: 500, n: 10 }], counted)).toBeNull();
    expect(dropExceedsCount([{ d: 500, n: 11 }], counted)).toEqual({ d: 500, wanted: 11, counted: 10 });
    expect(dropExceedsCount([{ d: 200, n: 1 }], counted)).toEqual({ d: 200, wanted: 1, counted: 0 });
    expect(dropExceedsCount([{ d: 100, n: 1 }], null)).toEqual({ d: 100, wanted: 1, counted: 0 });
  });

  it('reads a request into clean denominations and a total', () => {
    expect(readRequest([{ d: 100, n: 3 }, { d: 100, n: 2 }, { d: 7, n: 4 }, { d: 50, n: 0 }])).toEqual({ denominations: [{ d: 100, n: 5 }], amount: 500 });
    expect(readRequest([])).toBeNull();
    expect(readRequest('x')).toBeNull();
  });
});
