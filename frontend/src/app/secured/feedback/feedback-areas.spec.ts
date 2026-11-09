import { PageGuide } from '../../guide/app-guide-content';
import { MenuAccess } from '../menu';
import { areaForUrl, areasFor, featureLabel, FeedbackArea, SOMETHING_ELSE } from './feedback-areas';

const all: MenuAccess = { has: () => true, canOpen: () => true, pack: () => true };

describe('feedback areas', () => {
  it('shortens a guide task to a label', () => {
    expect(featureLabel('Mine: add a to-do with the day, the time and a priority, and mark it Done.')).toBe('Mine');
    expect(featureLabel('Search for a page or a job.')).toBe('Search for a page or a job');
    expect(featureLabel('  Start with Your day. ')).toBe('Start with Your day');
    const long = featureLabel('A very long task description that just keeps going on and on without any stop at all for ever');
    expect(long.length).toBeLessThanOrEqual(61);
    expect(long.endsWith('…')).toBeTrue();
    expect(featureLabel('Make it repeat every day, every week on chosen days, or every month, or have the next one made later.')).toBe('Make it repeat every day');
    expect(featureLabel('To-dos made by the KPI assistant appear here too, for the people in the team.')).toBe('To-dos made by the KPI assistant appear here too');
    expect(featureLabel('Short, task.')).toBe('Short, task');
  });

  it('offers the pages a login can open, each with its tasks and Something else last', () => {
    const areas = areasFor(all);
    expect(areas.length).toBeGreaterThan(10);
    const todos = areas.find((a) => a.id === 'nav-todos')!;
    expect(todos).toBeDefined();
    expect(todos.title).toBe('To-dos');
    expect(todos.features[todos.features.length - 1]).toBe(SOMETHING_ELSE);
    expect(todos.features.length).toBeGreaterThan(1);
    expect(new Set(todos.features).size).toBe(todos.features.length);
  });

  it('shows only the pages the role can open', () => {
    const none: MenuAccess = { has: () => false, canOpen: () => false, pack: () => false };
    const ids = areasFor(none).map((a) => a.id);
    expect(ids).toContain('nav-app-guide');   // open to everyone
    expect(ids).not.toContain('nav-sales');
  });

  it('finds the area of the screen the person is on', () => {
    const areas: FeedbackArea[] = [
      { id: 'a', title: 'Sales', group: 'Sell', route: '/secure/sales', features: [] },
      { id: 'b', title: 'Bills', group: 'Sell', route: '/secure/sales/pos/new', features: [] },
      { id: 'c', title: 'Customers', group: 'Sell', route: '/secure/customers/cust/list', features: [] },
    ];
    expect(areaForUrl('/secure/sales/pos/new?x=1', areas)!.id).toBe('b');   // the longest start wins, the query is ignored
    expect(areaForUrl('/secure/sales/list', areas)!.id).toBe('a');
    expect(areaForUrl('/secure/customers/cust/edit/5', areas)!.id).toBe('c'); // same part of the app
    expect(areaForUrl('/secure/unknown', areas)).toBeNull();
    expect(areaForUrl('', areas)).toBeNull();
  });
});
