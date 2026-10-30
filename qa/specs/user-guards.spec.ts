/**
 * Removing a login and changing an email - UGD-1..3
 * Nobody removes their own account; a removed login stops working at once; an email must fit, be free, and say plainly when it is not.
 * (The last-Business-Head refusal is covered by unit tests: proving it here would mean removing a QA fixture login.)
 */
import { test, expect, data } from '../fixtures/index.js';
import { apiLogin } from '../fixtures/auth.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;

async function roleId(api: any, name: string) {
  const roles = (await api.request('GET', '/roles', undefined, MGR)).body as any[];
  return roles.find((r) => r.name === name).id as number;
}
async function newUser(api: any, email: string) {
  const res = await api.request('POST', '/users', {
    fullname: 'QA Guard', email, password: PASS, phone: '9000000009', location: 'x', roleid: await roleId(api, 'Sales Staff'), storeids: [data.storesOf(1)[0].id],
  }, MGR);
  return res;
}

test('UGD-1 a Business Head cannot remove their own account', async ({ api }) => {
  const me = (await api.request('GET', '/auth/me', undefined, MGR)).body;
  const res = await api.request('DELETE', `/users/${me.id}`, undefined, MGR);
  expect(res.status).toBe(400);
  expect(JSON.stringify(res.body)).toContain('your own account');
  // still there, still able to sign in
  expect((await api.request('GET', '/auth/me', undefined, MGR)).status).toBe(200);
});

test('UGD-2 a removed login stops working at once, even with a token it already holds', async ({ api }) => {
  const email = `qa.ugd2.${stamp()}@local.test`;
  const made = await newUser(api, email);
  expect(made.status).toBeLessThan(300);
  const { token } = await apiLogin(email, PASS);
  const mine = (path: string) => fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  expect((await mine('/auth/me')).status).toBe(200);

  expect((await api.request('DELETE', `/users/${made.body.id}`, undefined, MGR)).status).toBeLessThan(300);
  expect((await mine('/auth/me')).status).toBe(401);
  const again = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASS, scope: 'business' }) });
  expect(again.status).toBe(401);
});

test('UGD-3 an email must look like one, be free, and the message says when a removed login holds it', async ({ api }) => {
  const a = `qa.ugd3a.${stamp()}@local.test`;
  const b = `qa.ugd3b.${stamp()}@local.test`;
  const first = await newUser(api, a);
  const second = await newUser(api, b);
  expect(first.status).toBeLessThan(300);
  expect(second.status).toBeLessThan(300);
  try {
    const bad = await newUser(api, 'not-an-email');
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('email');
    expect((await newUser(api, `${'x'.repeat(40)}@local.test`)).status).toBe(400);

    const dup = await newUser(api, a);
    expect(dup.status).toBe(409);
    expect(JSON.stringify(dup.body)).toContain('already used');
    const clash = await api.request('PUT', `/users/${second.body.id}`, { fullname: 'QA Guard', email: a }, MGR);
    expect(clash.status).toBe(409);

    // a free email is accepted, and the person signs in with it from then on
    const c = `qa.ugd3c.${stamp()}@local.test`;
    expect((await api.request('PUT', `/users/${second.body.id}`, { fullname: 'QA Guard', email: c }, MGR)).status).toBeLessThan(300);
    expect((await apiLogin(c, PASS)).me.id).toBe(second.body.id);

    // a removed login still holds its email
    expect((await api.request('DELETE', `/users/${first.body.id}`, undefined, MGR)).status).toBeLessThan(300);
    const reuse = await newUser(api, a);
    expect(reuse.status).toBe(409);
    expect(JSON.stringify(reuse.body)).toContain('removed');
  } finally {
    await api.request('DELETE', `/users/${second.body.id}`, undefined, MGR);
  }
});
