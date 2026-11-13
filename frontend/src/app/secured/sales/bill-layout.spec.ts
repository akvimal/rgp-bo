import { nameWithSuffix } from './bill-layout';

describe('bill name suffix', () => {
  it('adds the registered or trade-mark sign once', () => {
    expect(nameWithSuffix('Ram Pharmacy', 'R')).toBe('Ram Pharmacy®');
    expect(nameWithSuffix('Ram Pharmacy', 'TM')).toBe('Ram Pharmacy™');
    expect(nameWithSuffix('Ram Pharmacy™', 'TM')).toBe('Ram Pharmacy™');
  });
  it('adds nothing for none, unset or an empty name', () => {
    expect(nameWithSuffix('Ram Pharmacy', 'NONE')).toBe('Ram Pharmacy');
    expect(nameWithSuffix('Ram Pharmacy', undefined)).toBe('Ram Pharmacy');
    expect(nameWithSuffix('', 'R')).toBe('');
  });
});
