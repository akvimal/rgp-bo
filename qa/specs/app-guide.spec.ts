/**
 * The app guide — APPG-1..2
 * Every page of the menu has a guide entry and every entry points at a real page; what a login sees follows its role's permissions, so a counter login is not
 * shown the staff or finance pages and the owner is; a walk-through is shown only to a login that can open its first page; the owner can see which roles open
 * which pages. The rules are pure, so they run here directly against the roles the server holds.
 */
import { test, expect } from '../fixtures/index.js';
import { buildMenu, MenuAccess } from '../../frontend/src/app/secured/menu';
import { DAYS, GROUP_ORDER, PAGES, WALKTHROUGHS } from '../../frontend/src/app/guide/app-guide-content';
import { accessFromPermissions, dayKindOf, groupedPages, roleMatrix, searchGuide, visiblePages, visibleWalkthroughs } from '../../frontend/src/app/guide/app-guide-rules';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const packOn = (n: string) => n === 'pharmacy';
const everything: MenuAccess = { has: () => true, canOpen: () => true, pack: packOn };

test.describe('App guide @p1', () => {
  test('APPG-1 every menu page has an entry, every entry and walk-through points at a real page, and a login sees what its role opens @happy', async ({ api }) => {
    // the guide and the menu agree
    const menuIds: string[] = [];
    buildMenu(everything).forEach((g) => g.items.forEach((i) => menuIds.push(i.id)));
    const guideIds = PAGES.map((p) => p.id);
    expect(new Set(guideIds).size, 'entry ids are unique').toBe(guideIds.length);
    for (const id of menuIds) expect(guideIds, `the menu page ${id} has a guide entry`).toContain(id);
    for (const id of guideIds.filter((x) => x.startsWith('nav-'))) expect(menuIds, `the guide entry ${id} is a menu page`).toContain(id);
    for (const p of PAGES) {
      expect(p.purpose.length, p.id).toBeGreaterThan(20);
      expect(p.tasks.length, p.id).toBeGreaterThan(0);
      expect(p.route.startsWith('/secure/'), p.id).toBe(true);
      expect(GROUP_ORDER, p.id).toContain(p.group);
      if (!p.id.startsWith('nav-') && !p.always) expect(p.needs?.length, `${p.id} says which permission opens it`).toBeGreaterThan(0);
    }
    expect(new Set(WALKTHROUGHS.map((w) => w.id)).size).toBe(WALKTHROUGHS.length);
    for (const w of WALKTHROUGHS) {
      expect(guideIds, `walk-through ${w.id} starts on a real page`).toContain(w.from);
      expect(w.steps.length, w.id).toBeGreaterThan(2);
    }
    expect(DAYS.map((d) => d.kind)).toEqual(expect.arrayContaining(['counter', 'storehead', 'owner', 'other']));
    expect(dayKindOf('Counter')).toBe('counter');
    expect(dayKindOf('Sales Staff')).toBe('counter');
    expect(dayKindOf('Store Head')).toBe('storehead');
    expect(dayKindOf('Business Head')).toBe('owner');
    expect(dayKindOf('Owner-operator')).toBe('owner');
    expect(dayKindOf('Personal')).toBe('other');

    // what each real role sees
    const roles = (await api.request('GET', '/roles', undefined, MGR)).body as any[];
    expect(roles.length).toBeGreaterThan(2);
    const idsOf = (name: string) => {
      const r = roles.find((x) => x.name === name);
      expect(r, `the role ${name} exists`).toBeTruthy();
      return visiblePages(accessFromPermissions(r.permissions, packOn)).map((p) => p.id);
    };
    const owner = idsOf('Business Head');
    const counter = idsOf('Counter');
    for (const must of ['nav-sales', 'nav-hr', 'nav-finance', 'setup-users', 'setup-roles', 'setup-alerts', 'nav-app-guide', 'bell']) expect(owner, `the Business Head sees ${must}`).toContain(must);
    for (const must of ['nav-sales', 'nav-app-guide', 'bell']) expect(counter, `the counter sees ${must}`).toContain(must);
    for (const not of ['nav-hr', 'nav-finance', 'nav-gst-filing', 'setup-roles', 'setup-users', 'setup-alerts']) expect(counter, `the counter does not see ${not}`).not.toContain(not);
    expect(owner.length).toBeGreaterThan(counter.length);

    // walk-throughs follow the pages
    const ownerWalks = visibleWalkthroughs(visiblePages(accessFromPermissions(roles.find((r) => r.name === 'Business Head').permissions, packOn))).map((w) => w.id);
    const counterWalks = visibleWalkthroughs(visiblePages(accessFromPermissions(roles.find((r) => r.name === 'Counter').permissions, packOn))).map((w) => w.id);
    expect(ownerWalks).toEqual(expect.arrayContaining(['w-bill', 'w-hr-team', 'w-purchase']));
    expect(counterWalks).toContain('w-bill');
    expect(counterWalks).not.toContain('w-hr-team');
    expect(counterWalks).not.toContain('w-leave');

    // search finds what the login can open, and nothing it cannot
    const forOwner = visiblePages(accessFromPermissions(roles.find((r) => r.name === 'Business Head').permissions, packOn));
    const forCounter = visiblePages(accessFromPermissions(roles.find((r) => r.name === 'Counter').permissions, packOn));
    const find = (q: string, pages: any[]) => searchGuide(q, pages, visibleWalkthroughs(pages)).map((h) => h.id);
    expect(find('return', forOwner)).toContain('w-return');
    expect(find('payroll', forOwner)).toContain('nav-hr');
    expect(find('payroll', forCounter)).not.toContain('nav-hr');
    expect(find('zzzz-nothing', forOwner)).toEqual([]);
    expect(find('', forOwner)).toEqual([]);

    // the owner's table
    const matrix = roleMatrix(roles.map((r) => ({ name: r.name, permissions: r.permissions })), packOn);
    expect(matrix.find((m) => m.role === 'Business Head')!.ids.has('nav-hr')).toBe(true);
    expect(matrix.find((m) => m.role === 'Counter')!.ids.has('nav-hr')).toBe(false);
    expect(groupedPages(forCounter).map((g) => g.group)).not.toContain('setup');
  });

  test('APPG-2 the page shows a counter login its own pages, and the owner everything with the role table @happy', async ({ app }) => {
    const c = await app.open(COUNTER, '/secure/app-guide');
    await expect(c.page.getByTestId('ag-day')).toBeVisible();
    await expect(c.page.getByTestId('ag-day')).toContainText('Counter');
    await expect(c.page.getByTestId('ag-tab-roles')).toHaveCount(0);
    await c.page.getByTestId('ag-tab-pages').click();
    await expect(c.page.getByTestId('ag-page-nav-sales')).toBeVisible();
    await expect(c.page.getByTestId('ag-page-nav-hr')).toHaveCount(0);
    await c.page.getByTestId('ag-tab-jobs').click();
    await expect(c.page.getByTestId('ag-job-w-bill')).toBeVisible();
    await expect(c.page.getByTestId('ag-job-w-hr-team')).toHaveCount(0);
    await c.page.getByTestId('ag-search').fill('return');
    await expect(c.page.getByTestId('ag-hit').first()).toBeVisible();
    await c.page.getByTestId('ag-search').fill('payroll');
    await expect(c.page.getByTestId('ag-results')).toContainText('0 results');

    const o = await app.open(MGR, '/secure/app-guide');
    await o.page.getByTestId('ag-tab-pages').click();
    await expect(o.page.getByTestId('ag-page-nav-hr')).toBeVisible();
    await expect(o.page.getByTestId('ag-page-setup-users')).toBeVisible();
    await o.page.getByTestId('ag-tab-roles').click();
    await expect(o.page.getByTestId('ag-matrix')).toBeVisible();
    await expect(o.page.getByTestId('ag-can-nav-sales-Counter')).toBeVisible();
    await expect(o.page.getByTestId('ag-can-nav-hr-Counter')).toHaveCount(0);
  });
});
