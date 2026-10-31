import { checkGrants, DEFAULT_PLANS, effectiveModules } from './plans';

describe('plan grants', () => {
  const shop = DEFAULT_PLANS.find((p) => p.key === 'shop')!.modules;

  it('lets one customer be granted the pharmacy modules', () => {
    const g = checkGrants({ refills: true, drug_register: true });
    expect(g.error).toBeUndefined();
    const m = effectiveModules(shop, g.value!);
    expect(m.refills).toBe(true);
    expect(m.drug_register).toBe(true);
  });

  it('has the default plans allow them, and a plan that omits them leaves them off', () => {
    for (const p of DEFAULT_PLANS) expect([p.modules.drug_register, p.modules.refills, p.modules.returns]).toEqual([true, true, true]);
    expect(effectiveModules({ ...shop, refills: undefined }, {}).refills).toBeUndefined();
  });

  it('refuses a module it does not know and a value that is not on or off', () => {
    expect(checkGrants({ nope: true }).error).toMatch(/Unknown module/);
    expect(checkGrants({ refills: 'yes' }).error).toMatch(/Bad value/);
  });
});
