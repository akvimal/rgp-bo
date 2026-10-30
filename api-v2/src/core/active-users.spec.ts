import { ACTIVE_TTL_MS, forgetAllUsers, forgetUser, isActiveUser } from './active-users';

describe('remembering whether a login is active', () => {
  beforeEach(() => forgetAllUsers());

  it('asks once, then answers from memory until the time is up', async () => {
    const load = jest.fn(async () => true);
    expect(await isActiveUser(1, load, 1000)).toBe(true);
    expect(await isActiveUser(1, load, 1000 + ACTIVE_TTL_MS - 1)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await isActiveUser(1, load, 1000 + ACTIVE_TTL_MS)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('remembers each login separately, and a no as well as a yes', async () => {
    const load = jest.fn(async (id: number) => id !== 2);
    expect(await isActiveUser(1, load, 0)).toBe(true);
    expect(await isActiveUser(2, load, 0)).toBe(false);
    expect(await isActiveUser(2, load, 1)).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('forgetting a login makes the next request ask again, so a removal bites at once', async () => {
    let active = true;
    const load = jest.fn(async () => active);
    expect(await isActiveUser(5, load, 0)).toBe(true);
    active = false;
    expect(await isActiveUser(5, load, 1)).toBe(true);
    forgetUser(5);
    expect(await isActiveUser(5, load, 2)).toBe(false);
  });
  it('does not remember a failed lookup', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(true);
    await expect(isActiveUser(9, load, 0)).rejects.toThrow('db down');
    expect(await isActiveUser(9, load, 1)).toBe(true);
  });
});
