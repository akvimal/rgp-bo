import { TtlCache, cacheKey, heavy } from './heavy-query';

describe('ttl cache', () => {
  it('works a figure out once within the time to live', async () => {
    const c = new TtlCache(1000);
    let n = 0;
    const load = async () => ++n;
    expect(await c.get('a', load)).toBe(1);
    expect(await c.get('a', load)).toBe(1);
    expect(await c.get('b', load)).toBe(2);
  });
  it('shares one run between requests that arrive together', async () => {
    const c = new TtlCache(1000);
    let n = 0;
    const slow = () => new Promise<number>((r) => setTimeout(() => r(++n), 20));
    const [x, y, z] = await Promise.all([c.get('k', slow), c.get('k', slow), c.get('k', slow)]);
    expect([x, y, z]).toEqual([1, 1, 1]);
    expect(n).toBe(1);
  });
  it('works it out again after the time to live, and never keeps a failure', async () => {
    const c = new TtlCache(5);
    let n = 0;
    await c.get('a', async () => ++n);
    await new Promise((r) => setTimeout(r, 15));
    expect(await c.get('a', async () => ++n)).toBe(2);
    await expect(c.get('bad', async () => { throw new Error('no'); })).rejects.toThrow('no');
    expect(await c.get('bad', async () => 'fine')).toBe('fine');
  });
  it('forgets by prefix', async () => {
    const c = new TtlCache(1000);
    let n = 0;
    await c.get('one|x', async () => ++n);
    await c.get('two|x', async () => ++n);
    c.clear('one|');
    expect(await c.get('one|x', async () => ++n)).toBe(3);
    expect(await c.get('two|x', async () => ++n)).toBe(2);
  });
  it('builds a key from parts, ignoring the order of a list', () => {
    expect(cacheKey(1, 'owner', [3, 1, 2], null)).toBe('1|owner|1,2,3|-');
  });
});

describe('heavy', () => {
  const manager = (error?: any) => ({ transaction: async (fn: any) => { if (error) throw error; return fn({ query: async () => undefined }); } }) as any;
  it('returns the work\'s result', async () => { expect(await heavy(manager(), 5000, async () => 7)).toBe(7); });
  it('turns a database timeout into a plain message', async () => {
    await expect(heavy(manager({ code: '57014' }), 5000, async () => 1)).rejects.toThrow('took too long');
    await expect(heavy(manager(new Error('canceling statement due to statement timeout')), 5000, async () => 1)).rejects.toThrow('took too long');
  });
  it('lets another error through', async () => { await expect(heavy(manager(new Error('other')), 5000, async () => 1)).rejects.toThrow('other'); });
});
