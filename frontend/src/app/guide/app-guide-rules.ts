/**
 * What the app guide shows to a login. Pure (no Angular): a page is shown when the same menu the person navigates by shows it, so the guide follows
 * the role's permissions, the business's modules and the pharmacy pack with nothing to keep in step. A walk-through is shown when its first page is.
 */
import { MenuAccess, buildMenu, buildMyMenu, isCounterRole } from '../secured/menu';
import { DAYS, DayKind, DayPlan, GROUP_ORDER, GuideGroup, PAGES, PageGuide, WALKTHROUGHS, Walkthrough } from './app-guide-content';

/** the pages of the guide this login may use */
export function visiblePages(a: MenuAccess, pages: PageGuide[] = PAGES): PageGuide[] {
  const inMenu = new Set<string>();
  buildMenu(a).forEach((g) => g.items.forEach((i) => { if (i.show()) inMenu.add(i.id); }));
  buildMyMenu(a).forEach((i) => { if (i.show()) inMenu.add(i.id); });     // My shift, My HR, My KPI sit in the profile menu
  return pages.filter((p) => p.always || (p.id.startsWith('nav-') ? inMenu.has(p.id) : (p.needs || []).some((k) => a.has(k))));
}

export function visibleWalkthroughs(pages: PageGuide[], all: Walkthrough[] = WALKTHROUGHS): Walkthrough[] {
  const ids = new Set(pages.map((p) => p.id));
  return all.filter((w) => ids.has(w.from));
}

/** the pages in the order of the menu's groups, empty groups left out */
export function groupedPages(pages: PageGuide[]): { group: GuideGroup; pages: PageGuide[] }[] {
  return GROUP_ORDER.map((g) => ({ group: g, pages: pages.filter((p) => p.group === g) })).filter((g) => g.pages.length);
}

/** which "your day" a role gets */
export function dayKindOf(roleName: string | null | undefined): DayKind {
  if (isCounterRole(roleName)) return 'counter';
  if (roleName === 'Store Head') return 'storehead';
  if (roleName === 'Business Head' || roleName === 'Owner-operator') return 'owner';
  return 'other';
}

export const dayPlanOf = (kind: DayKind): DayPlan => DAYS.find((d) => d.kind === kind) || DAYS[DAYS.length - 1];

export interface GuideHit { kind: 'page' | 'walkthrough'; id: string; title: string; text: string; }

const words = (q: string) => String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/** a plain search over the pages and walk-throughs given (the ones this login may see): every word must be found, titles and keywords count most */
export function searchGuide(query: string, pages: PageGuide[], walks: Walkthrough[]): GuideHit[] {
  const ws = words(query);
  if (!ws.length) return [];
  const hits: (GuideHit & { score: number })[] = [];
  const score = (title: string, keys: string, body: string) => {
    let s = 0;
    for (const w of ws) {
      const t = title.toLowerCase().includes(w) ? 4 : 0, k = (keys || '').toLowerCase().includes(w) ? 2 : 0, b = body.toLowerCase().includes(w) ? 1 : 0;
      if (!t && !k && !b) return 0;
      s += t + k + b;
    }
    return s;
  };
  for (const p of pages) {
    const body = [p.purpose, p.who, ...p.tasks, ...(p.watch || [])].join(' ');
    const s = score(p.title, p.keywords || '', body);
    if (s) hits.push({ kind: 'page', id: p.id, title: p.title, text: p.purpose, score: s });
  }
  for (const w of walks) {
    const body = [...w.steps, ...(w.tips || [])].join(' ');
    const s = score(w.title, w.keywords || '', body);
    if (s) hits.push({ kind: 'walkthrough', id: w.id, title: w.title, text: w.steps[0], score: s });
  }
  return hits.sort((a, b) => b.score - a.score).map(({ score: _s, ...h }) => h);
}

// ------------------------------------------------------------------------------------------------ a role's permissions as the menu reads them
const matchesPath = (url: string, path: string): boolean => !!path && (url === path || url.startsWith(path + '/') || path.startsWith(url + '/'));

/**
 * The menu's view of a role from its saved permissions, the same way the signed-in user's permissions are read: an action is "resource.action" (or the
 * resource alone), and a page opens when a permission's path covers it. Used for the owner's table of what each role can do.
 */
export function accessFromPermissions(permissions: any, pack: (name: string) => boolean): MenuAccess {
  let list: any[] = [];
  try { list = Array.isArray(permissions) ? permissions : JSON.parse(permissions || '[]'); } catch { list = []; }
  const actions = new Set<string>();
  list.forEach((p: any) => {
    (p.policies || []).forEach((e: any) => actions.add(`${p.resource}.${e.action}`));
    actions.add(p.resource);
  });
  const canOpen = (url: string): boolean => {
    if (url === '/secure/notifications' || url === '/secure/app-guide') return true;
    if (url.split('?')[0] === '/secure/pharmacy-guide') return pack('pharmacy');
    return list.some((p: any) => (Array.isArray(p.path) ? p.path : [p.path]).some((x: string) => matchesPath(url, x)));
  };
  return { has: (...keys: string[]) => keys.some((k) => actions.has(k)), canOpen, pack };
}

/** for each role, the ids of the guide pages it can open (the owner's table) */
export function roleMatrix(roles: { name: string; permissions: any }[], pack: (name: string) => boolean, pages: PageGuide[] = PAGES): { role: string; ids: Set<string> }[] {
  return roles.map((r) => ({ role: r.name, ids: new Set(visiblePages(accessFromPermissions(r.permissions, pack), pages).map((p) => p.id)) }));
}
