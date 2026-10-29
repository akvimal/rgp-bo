/**
 * The grouped menu - MG-1..2
 * The eight-group menu is a per-business choice: off, the long-standing menu stays; on, the Business Head sees the groups in order, each entry under the job
 * it belongs to, and Compliance sits under Oversight. The setting is put back after.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

test.describe.serial('Grouped menu', () => {
  test.afterAll(async ({ api }) => { await api.request('DELETE', '/config/views/new_menu', undefined, MGR); });

  test('MG-1 off by default; the grouped menu is the Business Head\'s choice', async ({ api }) => {
    const r = await api.request('GET', '/config?scope=views', undefined, MGR);
    expect(r.body.items.find((i: any) => i.key === 'new_menu')).toMatchObject({ value: false, source: 'default' });
  });

  test('MG-2 on, the menu shows the groups in order with each page under its job', async ({ api, app }) => {
    expect((await api.request('PUT', '/config/views', { values: { new_menu: true }, effectiveFrom: today() }, MGR)).status).toBe(200);
    const { page } = await app.open(MGR, '/secure/dashboard');
    await expect(page.getByTestId('nav-section-home')).toBeVisible();
    const groups = await page.evaluate(() => {
      const out: Record<string, string[]> = {}; let cur = '';
      document.querySelectorAll('#sidebar-nav > li').forEach((li) => {
        const sec = li.getAttribute('data-testid') || '';
        if (sec.startsWith('nav-section-')) { cur = sec.replace('nav-section-', ''); out[cur] = []; return; }
        const a = li.querySelector('a[data-testid^="nav-"]');
        if (a && cur) out[cur].push(a.getAttribute('data-testid') as string);
      });
      return out;
    });
    expect(Object.keys(groups)).toEqual(['home', 'sell', 'stock', 'buy', 'accounts', 'people', 'oversight', 'admin']);
    expect(groups.home).toEqual(['nav-dashboard', 'nav-shift', 'nav-reports']);
    expect(groups.accounts).toEqual(['nav-expenses', 'nav-digital-payments', 'nav-gst-filing', 'nav-finance']);
    expect(groups.oversight).toEqual(['nav-compliance', 'nav-review', 'nav-quality']);
    await expect(page.getByTestId('nav-section-admin')).toHaveText('Setup');
  });
});
