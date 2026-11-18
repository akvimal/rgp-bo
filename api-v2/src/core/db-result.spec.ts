import { affectedRows } from './db-result';

describe('affectedRows', () => {
  it('counts the rows of an update or delete that returned [rows, count]', () => {
    expect(affectedRows([[{ id: 1 }, { id: 2 }], 2])).toBe(2);
    expect(affectedRows([[], 0])).toBe(0);                      // nothing changed: the shape still has two parts
  });
  it('counts the rows of a plain result, and treats anything else as none', () => {
    expect(affectedRows([{ id: 1 }, { id: 2 }, { id: 3 }])).toBe(3);
    expect(affectedRows([])).toBe(0);
    expect(affectedRows(undefined)).toBe(0);
  });
});
