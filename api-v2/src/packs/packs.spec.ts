import { packEnabled } from './packs';

describe('packs', () => {
  it('loads every pack when PACKS is not set', () => {
    expect(packEnabled('pharmacy', undefined)).toBe(true);
    expect(packEnabled('pharmacy', '')).toBe(true);
    expect(packEnabled('pharmacy', '  ')).toBe(true);
  });

  it('loads only the packs the environment lists', () => {
    expect(packEnabled('pharmacy', 'pharmacy')).toBe(true);
    expect(packEnabled('pharmacy', 'Pharmacy, electronics')).toBe(true);
    expect(packEnabled('pharmacy', 'electronics')).toBe(false);
    expect(packEnabled('pharmacy', 'none')).toBe(false);
  });

  it('does not load a pack that does not exist, unless it is listed', () => {
    expect(packEnabled('fitness', undefined)).toBe(false);
  });
});
