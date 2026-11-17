import { visiblePages } from '../guide/app-guide-rules';
import { PAGES } from '../guide/app-guide-content';
import { MenuAccess, MY_MENU_IDS, buildCounterMenu, buildMenu, buildMyMenu } from './menu';

const access = (granted: string[]): MenuAccess => ({ has: (...k: string[]) => k.some((x) => granted.includes(x)), canOpen: () => true, pack: () => true });
const ids = (groups: { items: { id: string }[] }[]) => groups.reduce((a: string[], g) => a.concat(g.items.map((i) => i.id)), []);

describe('the sidebar and the profile menu', () => {
  const everything = access(['shiftdesk.view', 'myhr.view', 'mykpi.view', 'sales', 'todos.view', 'hr.view', 'kpirate.rate']);

  it('keeps the person\'s own pages out of the sidebar', () => {
    const sidebar = ids(buildMenu(everything));
    MY_MENU_IDS.forEach((id) => expect(sidebar).not.toContain(id));
    expect(sidebar).toContain('nav-sales');
    expect(sidebar).toContain('nav-hr');
  });

  it('keeps them out of the counter layout too, and does not drop them into "More"', () => {
    const counter = buildCounterMenu(everything);
    MY_MENU_IDS.forEach((id) => expect(ids(counter)).not.toContain(id));
    expect(counter.some((g) => g.key === 'more' && g.items.some((i) => MY_MENU_IDS.includes(i.id)))).toBeFalse();
  });

  it('keeps Shifts, Cash book and Vault in their own Cash group, for a role that runs a drawer and not for a stock-only role', () => {
    const cash = (granted: string[]) => buildMenu(access(granted)).filter((g) => g.key === 'cash').reduce((a: string[], g) => a.concat(g.items.filter((i) => i.show()).map((i) => i.id)), []);
    expect(cash(['store.qty.adjust', 'store.read'])).toEqual([]);
    expect(cash(['store.shift.open'])).toEqual(['nav-shifts', 'nav-cash-book', 'nav-vault']);
    expect(ids(buildCounterMenu(access(['store.shift.open']))).filter((i) => i === 'nav-shifts').length).toBe(1);
    expect(buildCounterMenu(access(['store.shift.open'])).some((g) => g.key === 'more' && g.items.some((i) => i.id === 'nav-shifts'))).toBeFalse();
  });

  it('offers them in the profile menu, in this order, each for the permission it needs', () => {
    expect(buildMyMenu(everything).map((i) => i.id)).toEqual(['nav-shift', 'nav-my-hr', 'nav-kpi-mine']);
    expect(buildMyMenu(everything).map((i) => i.label)).toEqual(['My shift', 'My HR', 'My KPI']);
    const shown = (granted: string[]) => buildMyMenu(access(granted)).filter((i) => i.show()).map((i) => i.id);
    expect(shown(['shiftdesk.view'])).toEqual(['nav-shift']);
    expect(shown(['myhr.view', 'mykpi.view'])).toEqual(['nav-my-hr', 'nav-kpi-mine']);
    expect(shown(['sales'])).toEqual([]);
  });

  it('the app guide still lists those pages for the people who can open them', () => {
    const pages = visiblePages(access(['shiftdesk.view', 'myhr.view'])).map((p) => p.id);
    expect(pages).toContain('nav-shift');
    expect(pages).toContain('nav-my-hr');
    expect(pages).not.toContain('nav-kpi-mine');
  });
});

describe('the pages of the old Staff and quality drawer', () => {
  const all = access(['grievances.view', 'refills.view', 'staffsales.view', 'staffcredit.view', 'discrepancies.view', 'audit.view', 'purchases.add', 'purchases.request', 'finance.view']);
  const groupOf = (id: string) => buildMenu(all).find((g) => g.items.some((i) => i.id === id))?.key;
  const route = (id: string) => buildMenu(all).reduce((a: any[], g) => a.concat(g.items), []).find((i: any) => i.id === id)?.route;

  it('are not one entry any more: each is under the job it belongs to', () => {
    expect(ids(buildMenu(all))).not.toContain('nav-quality');
    expect(groupOf('nav-refills')).toBe('sell');
    expect(groupOf('nav-grievances')).toBe('sell');
    expect(groupOf('nav-discrepancies')).toBe('accounts');
    expect(groupOf('nav-staff-credit')).toBe('people');
    expect(groupOf('nav-staff-sales')).toBe('people');
    expect(groupOf('nav-audit')).toBe('oversight');
  });

  it('still open the same pages', () => {
    expect(route('nav-refills')).toBe('/secure/quality/refills');
    expect(route('nav-grievances')).toBe('/secure/quality/grievances');
    expect(route('nav-discrepancies')).toBe('/secure/quality/discrepancies');
    expect(route('nav-staff-credit')).toBe('/secure/quality/staff-credit');
    expect(route('nav-staff-sales')).toBe('/secure/quality/staff-sales');
    expect(route('nav-audit')).toBe('/secure/quality/audit');
  });

  it('each shows for its own permission only', () => {
    const drawer = ['nav-refills', 'nav-grievances', 'nav-discrepancies', 'nav-staff-credit', 'nav-staff-sales', 'nav-audit'];
    const shown = (granted: string[]) => buildMenu(access(granted)).reduce((a: any[], g) => a.concat(g.items), []).filter((i: any) => i.show() && drawer.includes(i.id)).map((i: any) => i.id);
    expect(shown(['refills.view'])).toEqual(['nav-refills']);
    expect(shown(['grievances.view'])).toEqual(['nav-grievances']);
    expect(shown(['audit.view', 'staffcredit.view'])).toEqual(['nav-staff-credit', 'nav-audit']);
  });

  it('show Refills to a manager too (no longer hidden when the role can also open grievances)', () => {
    const visible = buildMenu(access(['refills.view', 'grievances.view'])).reduce((a: any[], g) => a.concat(g.items), []).filter((i: any) => i.show()).map((i: any) => i.id);
    expect(visible).toContain('nav-refills');
    expect(visible).toContain('nav-grievances');
  });

  it('show Purchase requests next to Purchase for a role that holds both', () => {
    const both = buildMenu(access(['purchases.add', 'purchases.request'])).reduce((a: any[], g) => a.concat(g.items), []).filter((i: any) => i.show()).map((i: any) => i.id);
    expect(both).toContain('nav-purchases');
    expect(both).toContain('nav-purchase-requests');
  });

  it('are in the counter layout in their groups, not dropped into "More"', () => {
    const counter = buildCounterMenu(all);
    const more = counter.find((g) => g.key === 'more')?.items.map((i) => i.id) ?? [];
    // the audit log is Oversight, which the counter layout does not lay out: it goes to More with Reports and Compliance, as before
    ['nav-refills', 'nav-grievances', 'nav-discrepancies', 'nav-staff-credit', 'nav-staff-sales'].forEach((id) => expect(more).not.toContain(id));
    expect(counter.find((g) => g.key === 'sell')?.items.map((i) => i.id)).toEqual(jasmine.arrayContaining(['nav-refills', 'nav-grievances']));
    expect(counter.find((g) => g.key === 'people')?.items.map((i) => i.id)).toEqual(jasmine.arrayContaining(['nav-staff-credit', 'nav-staff-sales']));
  });
});

describe('the app guide and the menu', () => {
  it('has no page for a menu entry that does not exist (a renamed or retired entry leaves a stale guide page)', () => {
    const every = access(['shiftdesk.view', 'myhr.view', 'mykpi.view', 'sales', 'todos.view', 'hr.view', 'kpirate.rate']);
    const inMenu = new Set<string>();
    buildMenu({ ...every, has: () => true }).forEach((g) => g.items.forEach((i) => inMenu.add(i.id)));
    buildMyMenu({ ...every, has: () => true }).forEach((i) => inMenu.add(i.id));
    const stale = PAGES.filter((p) => p.id.startsWith('nav-') && !inMenu.has(p.id)).map((p) => p.id);
    expect(stale).toEqual([]);
  });
});
