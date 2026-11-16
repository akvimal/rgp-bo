import { buildCounterMenu, buildMenu, buildMyMenu } from './menu';
import { PERMISSION_CATALOG, PERMISSION_GROUPS } from './settings/roles/permission-catalog';

/**
 * The menu and the role editor must not drift apart (docs/planning/MENU_AND_PERMISSIONS.md): every permission a menu entry asks for has to be
 * a row, with that action, in the role editor's catalogue, or a role cannot be given the page except by an SQL migration.
 */
describe('the menu and the role editor catalogue', () => {
  /** every permission any entry asks for, read from the entries' declared `needs` */
  const everyItem = () => {
    const items = [...buildMenu(recording), ...buildCounterMenu(recording)].reduce((a: any[], g) => a.concat(g.items), []).concat(buildMyMenu(recording));
    return Array.from(new Set<string>(items.reduce((a: string[], i: any) => a.concat(i.needs), [] as string[])));
  };
  const recording = { has: () => true, canOpen: () => true, pack: () => true };

  it('has a catalogue row, with the action, for every permission the menu asks for', () => {
    const problems: string[] = [];
    everyItem().forEach((key) => {
      const [resource, action] = key.split('.');
      const row = PERMISSION_CATALOG.find((r) => r.key === resource);
      if (!row) problems.push(`${key}: no "${resource}" row`);
      else if (action && !row.actions.some((a) => a.key === action)) problems.push(`${key}: "${resource}" has no "${action}" action`);
    });
    expect(problems).toEqual([]);
  });

  it('puts every row in a known group and every group has a row', () => {
    PERMISSION_CATALOG.forEach((r) => expect(PERMISSION_GROUPS).toContain(r.group));
    PERMISSION_GROUPS.forEach((g) => expect(PERMISSION_CATALOG.some((r) => r.group === g)).toBeTrue());
  });

  it('lists each resource once', () => {
    const keys = PERMISSION_CATALOG.map((r) => r.key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it('gives Customer orders and Delivery partners their own rows', () => {
    expect(PERMISSION_CATALOG.find((r) => r.key === 'customerorders')?.actions.map((a) => a.key)).toEqual(['view', 'manage']);
    expect(PERMISSION_CATALOG.find((r) => r.key === 'deliverypartners')?.path).toBe('/secure/settings/delivery-partners');
  });
});

describe('the menu entries', () => {
  const recording = { has: () => true, canOpen: () => true, pack: () => true };
  const items = () => buildMenu(recording).reduce((a: any[], g) => a.concat(g.items), []).concat(buildMyMenu(recording));

  it('each declare what they open for, or have a rule of their own', () => {
    const own = items().filter((i: any) => !i.needs.length).map((i: any) => i.id).sort();
    expect(own).toEqual(['nav-app-guide', 'nav-dashboard', 'nav-knowledge', 'nav-pharmacy-guide']);       // the dashboard follows the route check, the guides are open
  });

  it('show exactly when the login holds one of the declared permissions', () => {
    const holding = (granted: string[]) => ({ has: (...k: string[]) => k.some((x) => granted.includes(x)), canOpen: () => true, pack: () => true });
    items().filter((i: any) => i.needs.length).forEach((i: any) => {
      const menu = buildMenu(holding([i.needs[0]])).reduce((a: any[], g) => a.concat(g.items), []).concat(buildMyMenu(holding([i.needs[0]])));
      expect(menu.find((m: any) => m.id === i.id).show()).toBeTrue();
      const none = buildMenu(holding([])).reduce((a: any[], g) => a.concat(g.items), []).concat(buildMyMenu(holding([])));
      expect(none.find((m: any) => m.id === i.id).show()).toBeFalse();
    });
  });
});
