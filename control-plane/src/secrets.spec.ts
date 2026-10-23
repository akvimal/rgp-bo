import { KEY_SHAPE, lock, unlock } from './secrets';

describe('stored customer keys', () => {
  it('lock and unlock, and look different each time', () => {
    const a = lock('sk-or-v1-abcdef0123456789'), b = lock('sk-or-v1-abcdef0123456789');
    expect(a).not.toContain('abcdef');
    expect(a).not.toBe(b);
    expect(unlock(a)).toBe('sk-or-v1-abcdef0123456789');
  });

  it('give nothing back for changed text, another secret or no text', () => {
    const a = lock('sk-or-v1-abcdef0123456789');
    expect(unlock(a.slice(0, -4) + 'AAAA')).toBeNull();
    expect(unlock('')).toBeNull();
    expect(unlock(null)).toBeNull();
    const before = process.env.ADMIN_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = 'another-secret';
    expect(unlock(a)).toBeNull();
    if (before === undefined) delete process.env.ADMIN_JWT_SECRET; else process.env.ADMIN_JWT_SECRET = before;
  });

  it('accepts real-looking keys and refuses anything that could break an env file', () => {
    expect(KEY_SHAPE.test('sk-or-v1-0123456789abcdef0123456789abcdef')).toBe(true);
    expect(KEY_SHAPE.test('short')).toBe(false);
    expect(KEY_SHAPE.test('sk-or-v1-0123456789abcdef\nJWT_KEY=x')).toBe(false);
    expect(KEY_SHAPE.test('sk-or-v1-0123456789 abcdef')).toBe(false);
    expect(KEY_SHAPE.test('sk-or-v1-0123456789$abcdef')).toBe(false);
  });
});
