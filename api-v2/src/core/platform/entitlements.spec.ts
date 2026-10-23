import { createHmac } from 'crypto';
import { ALL_ON } from '../modules/modules';
import { clampModules, lockedModules, verifyEntitlements } from './entitlements';

const b64u = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(body: any, secret: string, alg = 'HS256') {
  const h = b64u({ alg, typ: 'JWT' }), p = b64u(body);
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}
const body = (over: any = {}) => ({ iss: 'rgp-control-plane', slug: 'acme', status: 'active', modules: ALL_ON, limits: { stores: 1, users: 2 }, exp: Math.floor(Date.now() / 1000) + 3600, ...over });

describe('verifyEntitlements', () => {
  it('accepts a token signed with this customer\'s secret', () => {
    const e = verifyEntitlements(sign(body(), 's3cret'), 's3cret', 'acme');
    expect(e).toMatchObject({ slug: 'acme', status: 'active', expired: false });
  });

  it('refuses another secret, another customer, another issuer, a tampered body and an unsigned token', () => {
    const t = sign(body(), 's3cret');
    expect(verifyEntitlements(t, 'other', 'acme')).toBeNull();
    expect(verifyEntitlements(t, 's3cret', 'someone-else')).toBeNull();
    expect(verifyEntitlements(sign(body({ iss: 'me' }), 's3cret'), 's3cret', 'acme')).toBeNull();
    const [h, , s] = t.split('.');
    expect(verifyEntitlements(`${h}.${b64u(body({ status: 'active', limits: { stores: 99, users: 99 } }))}.${s}`, 's3cret', 'acme')).toBeNull();
    expect(verifyEntitlements(`${b64u({ alg: 'none' })}.${b64u(body())}.`, 's3cret', 'acme')).toBeNull();
    expect(verifyEntitlements('nonsense', 's3cret', 'acme')).toBeNull();
  });

  it('still returns an expired token (a lost connection must not stop trading), marked expired', () => {
    expect(verifyEntitlements(sign(body({ exp: 1 }), 's3cret'), 's3cret', 'acme')).toMatchObject({ expired: true, status: 'active' });
  });
});

describe('clampModules', () => {
  it('holds the owner\'s choices inside the plan', () => {
    const plan = { ...ALL_ON, hr: false, gst: false, purchasing: 'simple' as const, transfers: false };
    const out = clampModules(ALL_ON, plan);
    expect(out).toMatchObject({ hr: false, gst: false, purchasing: 'simple', transfers: false, expenses: true });
    expect(clampModules({ ...ALL_ON, purchasing: 'off' }, plan).purchasing).toBe('off');          // may choose less than the plan
    expect(clampModules({ ...ALL_ON, purchasing: 'off' }, ALL_ON).gst).toBe(false);
  });

  it('names what the plan leaves out', () => {
    expect(lockedModules({ ...ALL_ON, hr: false, purchasing: 'simple' }).sort()).toEqual(['hr', 'purchasing']);
    expect(lockedModules(ALL_ON)).toEqual([]);
  });
});
