import { hasVariance, varianceReasons } from './shift-variance';

const dig = (provider: string, system: number, counted: number) => ({ provider, system, counted, variance: Math.round((counted - system) * 100) / 100 });

describe('hasVariance', () => {
  it('is false for nothing and for float noise, true from a paisa', () => {
    expect(hasVariance(0)).toBe(false);
    expect(hasVariance(0.004)).toBe(false);
    expect(hasVariance(0.01)).toBe(true);
    expect(hasVariance(-25)).toBe(true);
  });
});

describe('varianceReasons', () => {
  it('needs nothing when everything matches', () => {
    const r = varianceReasons(0, '', [dig('UPI', 500, 500)], {});
    expect(r.problem).toBeNull();
    expect(r.cashReason).toBeNull();
    expect(r.digital![0].reason).toBeNull();
  });

  it('asks for a cash reason when the drawer is short or over', () => {
    expect(varianceReasons(-40, '', null, {}).problem).toMatch(/short by Rs 40/);
    expect(varianceReasons(15, ' ', null, {}).problem).toMatch(/over by Rs 15/);
    const ok = varianceReasons(-40, '  Gave   wrong change ', null, {});
    expect(ok.problem).toBeNull();
    expect(ok.cashReason).toBe('Gave wrong change');
  });

  it('asks for each provider with a difference separately', () => {
    const lines = [dig('UPI', 500, 480), dig('CARD', 300, 300), dig('WALLET', 100, 130)];
    const none = varianceReasons(0, '', lines, {});
    expect(none.problem).toMatch(/UPI total differs by Rs 20/);
    const upiOnly = varianceReasons(0, '', lines, { UPI: 'Refund not on terminal' });
    expect(upiOnly.problem).toMatch(/WALLET total differs by Rs 30/);
    const all = varianceReasons(0, '', lines, { UPI: 'Refund not on terminal', WALLET: 'Cashback credited' });
    expect(all.problem).toBeNull();
    expect(all.digital!.map((d) => d.reason)).toEqual(['Refund not on terminal', null, 'Cashback credited']);
  });

  it('needs both when cash and digital differ, and keeps a reason only where there is a difference', () => {
    const lines = [dig('UPI', 500, 480)];
    expect(varianceReasons(-10, 'Short change', lines, {}).problem).toMatch(/UPI/);
    expect(varianceReasons(-10, '', lines, { UPI: 'Refund' }).problem).toMatch(/drawer/);
    const r = varianceReasons(0, 'left over text', [dig('UPI', 500, 500)], { UPI: 'stale' });
    expect(r.cashReason).toBeNull();
    expect(r.digital![0].reason).toBeNull();
  });

  it('refuses a one-letter reason and trims a very long one', () => {
    expect(varianceReasons(-5, 'x', null, {}).problem).not.toBeNull();
    expect(varianceReasons(-5, 'a'.repeat(400), null, {}).cashReason!.length).toBe(300);
  });
});
