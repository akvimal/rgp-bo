import { ALL_ON, blockedBy, filterPermissions, gatedPath, parseModulesInput, resolveModules } from './modules';

describe('modules', () => {
  it('treats an empty setting as everything on', () => {
    expect(resolveModules({})).toEqual(ALL_ON);
    expect(resolveModules(null)).toEqual(ALL_ON);
  });

  it('keeps GST reconciliation off while purchasing is off, and remembers the choice', () => {
    expect(resolveModules({ purchasing: 'off' }).gst).toBe(false);
    expect(resolveModules({ purchasing: 'off', gst: true }).gst).toBe(false);
    expect(resolveModules({ purchasing: 'simple', gst: true }).gst).toBe(true);
  });

  it('refuses unknown modules and wrong value types', () => {
    expect(parseModulesInput({ rockets: true }).error).toMatch(/Unknown/);
    expect(parseModulesInput({ hr: 'yes' }).error).toMatch(/on or off/);
    expect(parseModulesInput({ purchasing: 'some' }).error).toMatch(/off, simple or full/);
    expect(parseModulesInput({ hr: false, purchasing: 'simple' }).error).toBeUndefined();
  });

  it('gates only the module paths', () => {
    expect(gatedPath('/expenses')).toBe(true);
    expect(gatedPath('/expenses/policy')).toBe(true);
    expect(gatedPath('/expensesx')).toBe(false);
    expect(gatedPath('/sales')).toBe(false);
    const off = resolveModules({ expenses: false, purchasing: 'simple' });
    expect(blockedBy('/expenses', off)).toMatch(/Expenses/);
    expect(blockedBy('/purchaseorders', off)).toMatch(/simple purchasing/);
    expect(blockedBy('/purchases', off)).toBeNull();
    expect(blockedBy('/sales', off)).toBeNull();
  });

  it('narrows permissions without touching the stored role', () => {
    const perms = [
      { resource: 'expenses', path: '/secure/expenses', policies: [{ action: 'view' }] },
      { resource: 'store', path: ['/secure/store/cash', '/secure/store/transfers'], policies: [{ action: 'read' }] },
      { resource: 'purchases', path: ['/secure/purchases'], policies: [{ action: 'add' }, { action: 'request' }] },
      { resource: 'purchaseorders', path: ['/secure/purchases/orders'], policies: [{ action: 'approve' }] },
    ];
    const kept = filterPermissions(perms, resolveModules({ expenses: false, transfers: false, purchasing: 'simple' }));
    expect(kept.map((p) => p.resource)).toEqual(['store', 'purchases']);
    expect(kept[0].path).toEqual(['/secure/store/cash']);
    expect(kept[1].policies.map((p: any) => p.action)).toEqual(['add']);
    expect(perms[1].path.length).toBe(2);                                    // the input is not mutated
    expect(filterPermissions(perms, ALL_ON)).toEqual(perms);
  });
});
