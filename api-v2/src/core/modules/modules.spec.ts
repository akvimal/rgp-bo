import { ALL_ON, blockedBy, filterPermissions, gatedPath, packsOf, parseModulesInput, resolveModules } from './modules';

describe('modules', () => {
  it('treats an empty setting as everything on', () => {
    expect(resolveModules({})).toEqual(ALL_ON);
    expect(resolveModules(null)).toEqual(ALL_ON);
  });

  it('switches a pack on for the business types it is made for, and off for the rest, unless the business chose', () => {
    expect(resolveModules({}, 'pharmacy').drug_register).toBe(true);
    expect(resolveModules({}, 'general').drug_register).toBe(false);
    expect(resolveModules({ drug_register: true }, 'general').drug_register).toBe(true);        // a choice wins over the default
    expect(resolveModules({ drug_register: false }, 'pharmacy').drug_register).toBe(false);
    expect(resolveModules({}).drug_register).toBe(true);                                         // no type: the businesses that were here first are pharmacies
    expect(packsOf('pharmacy')).toEqual(['pharmacy']);
    expect(packsOf('general')).toEqual([]);
  });

  it('gates the drug register path, and drops its permission when the module is off', () => {
    const off = resolveModules({}, 'general');
    expect(gatedPath('/schedule/register')).toBe(true);
    expect(blockedBy('/schedule/register', off)).toMatch(/Drug register/);
    expect(blockedBy('/schedule/register', resolveModules({}, 'pharmacy'))).toBeNull();
    const perms = [{ resource: 'scheduleregister', path: '/secure/schedule-register', policies: [{ action: 'view' }] }, { resource: 'sales', path: ['/secure/sales'], policies: [{ action: 'read' }] }];
    expect(filterPermissions(perms, off).map((p) => p.resource)).toEqual(['sales']);
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
