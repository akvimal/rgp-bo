import { PAGES, PageGuide, GROUP_LABELS } from '../../guide/app-guide-content';
import { visiblePages } from '../../guide/app-guide-rules';
import { MenuAccess } from '../menu';

/**
 * The module and feature a report is about. Not a list of its own: it is the app guide's pages (one per menu page, kept in step with the menu by the guide's
 * test) that the person's login can open, and the tasks the guide gives for each page. Pure (no Angular) so it is unit tested.
 */
export interface FeedbackArea { id: string; title: string; group: string; route: string; features: string[] }

export const SOMETHING_ELSE = 'Something else';

/** a guide task, a sentence, shortened to a label for a dropdown: the words before the first colon, else the first sentence or clause, at most 60 letters */
export function featureLabel(task: string): string {
  let t = String(task || '').trim();
  const colon = t.indexOf(':');
  if (colon > 3 && colon <= 60) t = t.slice(0, colon);
  else {
    const stop = t.search(/[.;](\s|$)/);
    if (stop > 3) t = t.slice(0, stop);
    if (t.length > 40) { const comma = t.indexOf(','); if (comma >= 12) t = t.slice(0, comma); } // a long sentence: its first clause
  }
  t = t.replace(/\s+/g, ' ').replace(/[.:;,\s]+$/, '').trim();
  if (t.length <= 60) return t;
  const cut = t.slice(0, 59);
  const space = cut.lastIndexOf(' ');
  return (space > 30 ? cut.slice(0, space) : cut).replace(/[,\s]+$/, '') + '…';
}

/** the pages this login can open, as areas, in the guide's order; each with its features and "Something else" last */
export function areasFor(access: MenuAccess, pages: PageGuide[] = PAGES): FeedbackArea[] {
  return visiblePages(access, pages)
    .filter((p) => p.id !== 'nav-feedback') // a report about the report page is fine, but it is not a module to choose from a closed list
    .map((p) => {
      const seen = new Set<string>();
      const features = (p.tasks || []).map(featureLabel).filter((f) => f && !seen.has(f) && !!seen.add(f));
      return { id: p.id, title: p.title, group: GROUP_LABELS[p.group] || p.group, route: p.route, features: [...features, SOMETHING_ELSE] };
    });
}

const path = (u: string) => String(u || '').split(/[?#]/)[0].replace(/\/+$/, '');

/** the area of the screen a person is on: the page whose route is the longest start of the address, else the page in the same part of the app */
export function areaForUrl(url: string, areas: FeedbackArea[]): FeedbackArea | null {
  const u = path(url);
  if (!u) return null;
  let best: FeedbackArea | null = null;
  for (const a of areas) {
    const r = path(a.route);
    if ((u === r || u.startsWith(r + '/')) && (!best || r.length > path(best.route).length)) best = a;
  }
  if (best) return best;
  const part = u.split('/').slice(0, 3).join('/'); // /secure/customers
  return areas.find((a) => path(a.route).split('/').slice(0, 3).join('/') === part) || null;
}
