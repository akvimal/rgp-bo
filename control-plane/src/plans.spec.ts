import { checkGrants, DEFAULT_PLANS, effectiveModules } from './plans';

describe('plan grants', () => {
  const shop = DEFAULT_PLANS.find((p) => p.key === 'shop')!.modules;

  it('lets one customer be granted the pharmacy modules', () => {
    const g = checkGrants({ refills: true, drug_register: true });
    expect(g.error).toBeUndefined();
    const m = effectiveModules(shop, g.value!);
    expect(m.refills).toBe(true);
    expect(m.drug_register).toBe(true);
    expect(m.returns).toBeUndefined();
  });

  it('leaves them off for a customer with no grant', () => {
    expect(effectiveModules(shop, {}).refills).toBeUndefined();
  });

  it('refuses a module it does not know and a value that is not on or off', () => {
    expect(checkGrants({ nope: true }).error).toMatch(/Unknown module/);
    expect(checkGrants({ refills: 'yes' }).error).toMatch(/Bad value/);
  });
});
