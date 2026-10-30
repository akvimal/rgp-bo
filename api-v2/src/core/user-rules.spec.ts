import { emailProblem, emailTakenMessage, removalBlock } from './user-rules';

describe('removing a login', () => {
  it('nobody removes their own account', () => {
    expect(removalBlock(5, 5, 'Business Head', 3)).toContain('your own account');
    expect(removalBlock(5, 5, 'Sales Staff', 0)).toContain('your own account');
  });
  it('the last active Business Head or Owner-operator of a business cannot be removed, and the message names what to do', () => {
    expect(removalBlock(1, 2, 'Business Head', 0)).toContain('only active Business Head');
    expect(removalBlock(1, 2, 'Owner-operator', 0)).toContain('only active Owner-operator');
    expect(removalBlock(1, 2, 'Business Head', 0)).toContain('add another');
  });
  it('a head can be removed while another is active, and other roles are never held back by the count', () => {
    expect(removalBlock(1, 2, 'Business Head', 1)).toBeNull();
    expect(removalBlock(1, 3, 'Sales Staff', 0)).toBeNull();
    expect(removalBlock(1, 3, 'Store Head', 0)).toBeNull();
    expect(removalBlock(1, 3, undefined, 0)).toBeNull();
  });
});

describe('an email address', () => {
  it('is trimmed and accepted when it looks like an email and fits 40 characters', () => {
    expect(emailProblem('  owner@demo-shop.test ')).toEqual({ value: 'owner@demo-shop.test' });
    expect(emailProblem('a'.repeat(28) + '@example.com')).toEqual({ value: 'a'.repeat(28) + '@example.com' });
  });
  it('is refused when empty, too long, or not shaped like an email', () => {
    for (const bad of [undefined, null, '', '   ', 42]) expect('error' in emailProblem(bad)).toBe(true);
    expect(emailProblem('a'.repeat(30) + '@example.com')).toEqual({ error: expect.stringContaining('40 characters') });
    for (const bad of ['owner', 'owner@', '@x.com', 'a b@x.com', 'a@b']) expect(emailProblem(bad)).toEqual({ error: expect.stringContaining('email') });
  });
  it('says plainly when the email belongs to a removed login', () => {
    expect(emailTakenMessage(true)).toContain('removed');
    expect(emailTakenMessage(false)).toContain('already used');
  });
});
