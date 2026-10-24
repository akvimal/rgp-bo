import { classifyChange, netRate, percentSetting, unitJump } from './price-rules';

describe('price rules', () => {
  it('takes the discount off the printed rate', () => {
    expect(netRate(100, 10)).toBe(90);
    expect(netRate('118', null)).toBe(118);
  });

  it('passes a rise within the tolerance', () => {
    expect(classifyChange(100, 100.5, 0.5, 5)).toEqual({ pcnt: 0.5, level: 'NONE' });
  });

  it('asks for a reason above the tolerance', () => {
    expect(classifyChange(100, 102, 0.5, 5)).toEqual({ pcnt: 2, level: 'REASON' });
  });

  it('asks for approval above the approval percent', () => {
    expect(classifyChange(100, 105, 0.5, 5)).toEqual({ pcnt: 5, level: 'REASON' });
    expect(classifyChange(100, 105.5, 0.5, 5)).toEqual({ pcnt: 5.5, level: 'APPROVAL' });
  });

  it('says nothing about a fall, a first purchase or a zero rate', () => {
    expect(classifyChange(100, 90, 0.5, 5).level).toBe('NONE');
    expect(classifyChange(null, 90, 0.5, 5)).toEqual({ pcnt: null, level: 'NONE' });
    expect(classifyChange(100, 0, 0.5, 5).level).toBe('NONE');
  });

  it('spots a unit change from a jump in MRP', () => {
    expect(unitJump(10.55, 105.94)).toBe(10.04);
    expect(unitJump(105.94, 10.55)).toBe(0.1);
    expect(unitJump(100, 120)).toBeNull();
    expect(unitJump(null, 120)).toBeNull();
    expect(unitJump(100, 0)).toBeNull();
  });

  it('reads a setting, falling back when it is missing or silly', () => {
    expect(percentSetting('2.5', 5)).toBe(2.5);
    expect(percentSetting(undefined, 5)).toBe(5);
    expect(percentSetting('abc', 5)).toBe(5);
    expect(percentSetting('150', 5)).toBe(5);
  });
});
