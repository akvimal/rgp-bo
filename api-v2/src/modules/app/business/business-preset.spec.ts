import { planPreset, StoreNow } from './business-preset';

const store = (id: number, over: Partial<StoreNow> = {}): StoreNow => ({ id, location: `Store ${id}`, shiftmode: 'time', operatorrequired: true, openshifts: 0, ...over });
const now = (stores: StoreNow[], over: any = {}) => ({
  approvalmode: 'separate' as const,
  modules: { hr: true, transfers: true, stock_audits: true },
  stores,
  ...over,
});

describe('planPreset', () => {
  it('solo: one person, own approvals, drawer per person, HR / transfers / audits hidden', () => {
    const p = planPreset({ preset: 'solo' }, now([store(1)]));
    expect(p.approvalmode).toBe('self');
    expect(p.modules).toEqual({ hr: false, transfers: false, stock_audits: false });
    expect(p.stores[0]).toMatchObject({ shiftmode: 'staff', operatorrequired: false });
    expect(p.blockers).toEqual([]);
  });

  it('owner and staff: HR is optional, transfers hidden, shift mode follows the choice', () => {
    const keep = planPreset({ preset: 'owner_and_staff' }, now([store(1)], { modules: { hr: false, transfers: true, stock_audits: false } }));
    expect(keep.modules).toEqual({ transfers: false, stock_audits: true });                // HR left as it was
    const withHr = planPreset({ preset: 'owner_and_staff', hr: true, shiftmode: 'staff' }, now([store(1)], { modules: { hr: false, transfers: true, stock_audits: true } }));
    expect(withHr.modules.hr).toBe(true);
    expect(withHr.stores[0].shiftmode).toBe('staff');
  });

  it('manager and staff: separate approvals; transfers only when there is more than one store', () => {
    expect(planPreset({ preset: 'manager_and_staff' }, now([store(1)], { approvalmode: 'self' })).approvalmode).toBe('separate');
    expect(planPreset({ preset: 'manager_and_staff' }, now([store(1)])).modules.transfers).toBe(false);
    expect(planPreset({ preset: 'manager_and_staff' }, now([store(1), store(2)], { modules: { hr: true, transfers: false, stock_audits: true } })).modules.transfers).toBe(true);
  });

  it('multi store: nothing hidden, a mode per store', () => {
    const p = planPreset({ preset: 'multi_store', stores: { '2': { shiftmode: 'staff' } } },
      now([store(1), store(2)], { modules: { hr: false, transfers: false, stock_audits: false } }));
    expect(p.modules).toEqual({ hr: true, transfers: true, stock_audits: true });
    expect(p.stores.map((s) => s.shiftmode)).toEqual(['time', 'staff']);
    expect(p.stores[1].operatorrequired).toBe(false);
  });

  it('a store with a shift open cannot change its mode; one that keeps its mode is fine', () => {
    const p = planPreset({ preset: 'solo' }, now([store(1, { openshifts: 1 }), store(2, { shiftmode: 'staff', operatorrequired: false, openshifts: 2 })]));
    expect(p.stores[0].blocked).toMatch(/open shift/);
    expect(p.stores[1].blocked).toBeUndefined();
    expect(p.blockers).toHaveLength(1);
  });

  it('reports only what changes', () => {
    const settled = planPreset({ preset: 'multi_store' }, now([store(1)], { approvalmode: 'separate' }));
    expect(settled.changes).toEqual([]);
    expect(settled.stores[0].changes).toEqual([]);
  });
});
