/**
 * Uploaded files — FILE-1..2
 * A new kind of upload must not crash the API, the folder name cannot leave the upload folder, and only uploaded files can be read back.
 */
import { test, expect } from '../fixtures/index.js';

const API = () => process.env.QA_API_URL as string;
let TOKEN = '';

test.beforeAll(async () => {
  TOKEN = (await (await fetch(`${API()}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'businesshead@local.test', password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
});

async function upload(query: string, type = 'application/pdf', name = 'a.pdf') {
  const f = new FormData();
  f.append('file', new Blob(['%PDF-1.4\n%%EOF'], { type }), name);
  const r = await fetch(`${API()}/files/upload?${query}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: f });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.describe('Uploaded files @p1', () => {
  test('FILE-1 a new kind of upload is stored; a folder name cannot climb out of the upload folder @edge', async () => {
    const fresh = await upload(`qa${Date.now()}=7-1`);
    expect(fresh.status).toBeLessThan(300);                                                         // an unseen folder used to crash the API
    expect(fresh.body.path).toMatch(/\/qa\d+\/7-1\//);

    const sneaky = await upload('..%2F..%2Fetc=..%2F..%2Ftmp');
    expect(sneaky.status).toBeLessThan(300);
    expect(sneaky.body.path).not.toContain('..');

    expect((await upload('x=1', 'text/html', 'a.html')).status).toBe(400);                         // only PDF and images
    const health = await fetch(`${API()}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(health.status).toBe(401);                                                                // still up
  });

  test('FILE-2 only files under the upload folder can be read back @negative', async () => {
    const up = await upload(`qa${Date.now()}=9-9`);
    const view = (path: string) => fetch(`${API()}/files/view`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ path }),
    });
    expect((await view(up.body.path)).status).toBeLessThan(300);
    expect((await view('/etc/passwd')).status).toBe(403);
    expect((await view(`${up.body.path}/../../../../../etc/passwd`)).status).toBe(403);
    expect((await view('/usr/src/app/upload/none/missing.pdf')).status).toBe(404);
  });
});
