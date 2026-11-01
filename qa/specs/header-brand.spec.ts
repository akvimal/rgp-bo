/**
 * The header brand — HDR-1
 * Counter and store logins carry no business of their own (they work in their store's business), but the header still shows the business's name and logo,
 * and the app still knows the business's kind, the same as for the Business Head.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_LOGINS = ['sales1@local.test', 'storehead@local.test'];

test.describe('Header brand @p1', () => {
  test('HDR-1 a login placed through its store gets the business name, logo field and kind, as the Business Head does @happy', async ({ api }) => {
    const head = (await api.request('GET', '/auth/me', undefined, MGR)).body;
    expect(head.businessname).toBeTruthy();
    for (const who of STORE_LOGINS) {
      const me = (await api.request('GET', '/auth/me', undefined, who)).body;
      expect(me.businessid, who).toBe(head.businessid);
      expect(me.businessname, who).toBe(head.businessname);
      expect(me.businesslogo ?? null, who).toBe(head.businesslogo ?? null);
      expect(me.businesstype, who).toBe(head.businesstype);
    }
  });
});
