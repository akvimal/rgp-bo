import { bestMarkupPct, mrpRatio, ratioSetting } from './receiving-check';

describe('receiving check', () => {
  it('compares the MRP without GST with the cost', () => {
    expect(mrpRatio(105, 5, 20)).toBe(5);              // 105 incl 5% = 100 ex GST, cost 20
    expect(mrpRatio(118, 18, 25)).toBe(4);
    expect(mrpRatio(0, 5, 20)).toBeNull();
    expect(mrpRatio(100, 5, 0)).toBeNull();
  });

  it('gives the markup that selling at the MRP leaves', () => {
    expect(bestMarkupPct(105, 5, 20)).toBe(400);
    expect(bestMarkupPct(105, 5, 100)).toBe(0);
    expect(bestMarkupPct(105, 5, 120)).toBe(-16.67);
    expect(bestMarkupPct(105, 5, 0)).toBeNull();
  });

  it('reads the flag ratio setting', () => {
    expect(ratioSetting('8')).toBe(8);
    expect(ratioSetting('1')).toBe(6);
    expect(ratioSetting('99')).toBe(6);
    expect(ratioSetting(undefined)).toBe(6);
  });
});
