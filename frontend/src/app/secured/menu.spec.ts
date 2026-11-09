import { visiblePages } from '../guide/app-guide-rules';
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
