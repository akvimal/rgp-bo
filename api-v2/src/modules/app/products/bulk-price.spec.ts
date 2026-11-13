import { bulkTarget } from './bulk-price';

describe('bulkTarget', () => {
  it('same as MRP is the MRP less GST (what the bill charges with GST is the MRP)', () => {
    expect(bulkTarget('MRP', null, 105, 5)).toBe(100);
    expect(bulkTarget('MRP', null, 100, 0)).toBe(100);
  });
  it('x% off MRP is taken off the MRP, then GST is taken out', () => {
    expect(bulkTarget('PCT_OFF', 5, 200, 5)).toBe(180.95); // 190 with GST
    expect(bulkTarget('PCT_OFF', 10, 100, 0)).toBe(90);
  });
  it('is null without a usable MRP or with a bad percentage', () => {
    expect(bulkTarget('MRP', null, null, 5)).toBeNull();
    expect(bulkTarget('PCT_OFF', 5, 0, 5)).toBeNull();
    expect(bulkTarget('PCT_OFF', 0, 100, 5)).toBeNull();
    expect(bulkTarget('PCT_OFF', 100, 100, 5)).toBeNull();
    expect(bulkTarget('PCT_OFF', undefined, 100, 5)).toBeNull();
  });
});
