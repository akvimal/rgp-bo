/**
 * Cross-checks spec coverage against docs/testing/manual-test-plan.html, both ways:
 *  - plan IDs with no matching `test('<ID> ...')`  (missing a spec)
 *  - spec IDs (`test('<ID> ...')`) with no row in the plan  (undocumented)
 * Exit non-zero only when --strict and either gap remains.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PLAN = join(process.cwd(), '..', 'docs', 'testing', 'manual-test-plan.html');
const SPECS = join(process.cwd(), 'specs');
const strict = process.argv.includes('--strict');

// case ids from the DATA[] array (id:"AUTH-1", id:"XFER-LIFECYCLE", ...)
const planIds = [...readFileSync(PLAN, 'utf8').matchAll(/id:\s*"([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)"/g)].map((m) => m[1]);
const uniquePlan = [...new Set(planIds)];

// case ids referenced by specs (test('AUTH-1 ...'), covers "AUTH-1/2", "AUTH-1..12")
const specText = readdirSync(SPECS)
  .filter((f) => f.endsWith('.spec.ts') && !f.startsWith('_'))
  .map((f) => readFileSync(join(SPECS, f), 'utf8'))
  .join('\n');

const covered = new Set<string>();
// named ids ("XFER-LIFECYCLE", "DASH-admin") are the first word of a test title
const specIds = new Set<string>();
for (const m of specText.matchAll(/\btest\(\s*['"`]([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)[\s'"`]/g)) {
  const id = m[1].toUpperCase();
  specIds.add(id);
  covered.add(id);
}
for (const m of specText.matchAll(/\b([A-Z]{2,6})-(\d{1,2})(?:\s*\.\.\s*(\d{1,2}))?(?:\s*\/\s*(\d{1,2}))?/g)) {
  const [, mod, a, range, alt] = m;
  covered.add(`${mod}-${a}`);
  if (alt) covered.add(`${mod}-${alt}`);
  if (range) for (let i = +a; i <= +range; i++) covered.add(`${mod}-${i}`);
}

const missing = uniquePlan.filter((id) => !covered.has(id));
const planSet = new Set(uniquePlan);
const undocumented = [...specIds].filter((id) => !planSet.has(id)).sort();
const byModule = new Map<string, { total: number; done: number }>();
for (const id of uniquePlan) {
  const mod = id.split('-')[0];
  const e = byModule.get(mod) || { total: 0, done: 0 };
  e.total++;
  if (covered.has(id)) e.done++;
  byModule.set(mod, e);
}

console.log('coverage vs manual-test-plan.html\n');
for (const [mod, e] of [...byModule].sort()) {
  const bar = e.done === e.total ? 'OK ' : '   ';
  console.log(`  ${bar} ${mod.padEnd(6)} ${e.done}/${e.total}`);
}
console.log(`\n  total: ${uniquePlan.length - missing.length}/${uniquePlan.length} case IDs referenced by a spec`);
if (missing.length) console.log(`  missing a spec: ${missing.join(', ')}`);
console.log(`  spec IDs not in the plan: ${undocumented.length}`);
if (undocumented.length) console.log(`  undocumented: ${undocumented.join(', ')}`);

if (strict && (missing.length || undocumented.length)) process.exit(1);
