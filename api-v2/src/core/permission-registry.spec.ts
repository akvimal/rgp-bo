import * as fs from 'fs';
import * as path from 'path';
import { ALL_ON, filterPermissions, ModuleState } from './modules/modules';
import { PLATFORM_ONLY } from './role-rules';

/**
 * The permission registry (frontend/src/app/@core/auth/permission-registry.json) is the one list of every permission: the role editor, the menu and
 * the route check read it. This compares it with what the API and the screens actually use, so a permission cannot exist in one place only.
 * It reads the frontend's files, so it runs from a full checkout and is skipped where only api-v2 is present.
 */
const ROOT = path.resolve(__dirname, '../../..');
const REGISTRY = path.join(ROOT, 'frontend/src/app/@core/auth/permission-registry.json');
const present = fs.existsSync(REGISTRY);
const maybe = present ? describe : describe.skip;

const walk = (dir: string, ok: (f: string) => boolean, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, ok, out); else if (ok(f)) out.push(f);
  }
  return out;
};

maybe('the permission registry', () => {
  const registry = JSON.parse(present ? fs.readFileSync(REGISTRY, 'utf-8') : '{"groups":[],"resources":[]}');
  const resources: any[] = registry.resources;
  const byKey = new Map<string, any>(resources.map((r) => [r.key, r]));
  const has = (resource: string, action?: string) => {
    const r = byKey.get(resource);
    return !!r && (!action || r.actions.some((a: any) => a.key === action) || r.presenceOnly === true);
  };

  it('is well formed: unique keys, known groups, absolute page paths, unique actions', () => {
    const keys = resources.map((r) => r.key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    resources.forEach((r) => {
      expect(registry.groups).toContain(r.group);
      [].concat(r.path).forEach((p: string) => expect(p.startsWith('/secure/')).toBe(true));
      const actions = r.actions.map((a: any) => a.key);
      expect(actions.filter((k: string, i: number) => actions.indexOf(k) !== i)).toEqual([]);
    });
  });

  it('has every permission the API checks by name (@Permission, can, hasPermission, grants, canUseGst)', () => {
    const used = new Set<string>();
    const files = walk(path.join(ROOT, 'api-v2/src'), (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    const rules: RegExp[] = [
      /@Permission\(\s*['"]([a-z]+):([a-zA-Z.]+)['"]\s*\)/g,
      /(?:\.can|hasPermission|grants)\(\s*[^,()]+,\s*'([a-z]+)',\s*'([a-zA-Z.]+)'/g,
    ];
    files.forEach((f) => {
      const text = fs.readFileSync(f, 'utf-8');
      rules.forEach((re) => { let m: RegExpExecArray | null; while ((m = re.exec(text))) used.add(`${m[1]}.${m[2]}`); });
    });
    ['read', 'import', 'reconcile', 'lock'].forEach((a) => used.add(`gst.${a}`));     // PermissionService.canUseGst
    used.add('deliverypartners.manage');                                                // @Permission('manageDeliveryPartners')
    expect(used.size).toBeGreaterThan(15);                                             // the scan found the checks, not nothing
    const missing = [...used].filter((k) => { const [r, ...a] = k.split('.'); return !has(r, a.join('.')); });
    expect(missing).toEqual([]);
  });

  it('has every permission the screens ask for (*isAuth, has(), isActionAuthorized)', () => {
    const files = walk(path.join(ROOT, 'frontend/src/app'), (f) => f.endsWith('.html') || (f.endsWith('.ts') && !f.endsWith('.spec.ts')));
    const asked = new Set<string>();
    files.forEach((f) => {
      const text = fs.readFileSync(f, 'utf-8');
      let m: RegExpExecArray | null;
      const isAuth = /\*isAuth="'([a-zA-Z.]+)'"/g;
      while ((m = isAuth.exec(text))) asked.add(m[1]);
      // has('a.b', 'c') in a template is the shell's permission check (a bare call: query-parameter and Set lookups are written x.has(...))
      const hasCalls = f.endsWith('.html') ? /(?<![.\w])has\(([^)]*)\)/g : /isActionAuthorized\(([^)]*)\)/g;
      while ((m = hasCalls.exec(text))) (m[1].match(/'([a-zA-Z.]+)'/g) || []).forEach((q) => asked.add(q.slice(1, -1)));
    });
    // settings.read is not a row: the role editor writes the settings block itself from the settings pages a role is given
    const derived = new Set(['settings.read']);
    const missing = [...asked].filter((k) => !derived.has(k)).filter((k) => { const [r, ...a] = k.split('.'); return !has(r, a.join('.')); });
    expect(asked.size).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  it('agrees with the API about which module each resource depends on', () => {
    const off: Record<string, Partial<ModuleState>> = {
      hr: { hr: false }, purchasing: { purchasing: 'off' }, purchasing_full: { purchasing: 'simple' }, expenses: { expenses: false },
      payment_recon: { payment_recon: false }, stock_audits: { stock_audits: false }, refills: { refills: false }, returns: { returns: false },
      drug_register: { drug_register: false }, feedback: { feedback: false }, gst: { gst: false },
    };
    const base: ModuleState = { ...ALL_ON, feedback: true };
    const block = (r: any) => [{ resource: r.key, path: '/secure/x', policies: [{ action: r.actions[0]?.key || 'view' }] }];
    const problems: string[] = [];
    resources.forEach((r) => {
      if (r.availability === 'platform') return;                                      // a hosting choice, not a business module
      if (r.availability && !off[r.availability]) problems.push(`${r.key}: unknown module "${r.availability}"`);
      if (filterPermissions(block(r), base).length !== 1) problems.push(`${r.key}: dropped with every module on`);
      Object.entries(off).forEach(([tag, change]) => {
        const kept = filterPermissions(block(r), { ...base, ...change } as ModuleState).length === 1;
        // the purchasing tags nest: purchasing off also takes away what needs full purchasing
        const goes = r.availability === tag || (tag === 'purchasing' && r.availability === 'purchasing_full');
        if (goes && kept) problems.push(`${r.key}: kept when ${tag} is off`);
        if (!goes && !kept) problems.push(`${r.key}: dropped when ${tag} is off`);
      });
    });
    expect(problems).toEqual([]);
  });

  it('lists the platform-only resources the API keeps from businesses', () => {
    PLATFORM_ONLY.forEach((k) => expect(byKey.has(k)).toBe(true));
  });
});
