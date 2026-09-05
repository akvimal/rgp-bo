/**
 * Seed orchestrator.  `tsx seed/run.ts [--reset]`
 * Idempotent: if the marker business already exists it exits (unless --reset,
 * which just proceeds and layers more data — a true wipe is `npm run stack:up`).
 */
import 'dotenv/config';
import { GET, login, ApiError } from './client.js';
import { SEED } from './personas.js';
import { profile } from './volume.js';
import { buildCatalog } from './catalog.js';
import { stockIn, salesHistory } from './operations.js';
import { readManifest, writeManifest, type Manifest } from './manifest.js';
import { closeDb } from './db.js';

const MARKER = 'QA Seed Marker';
const reset = process.argv.includes('--reset');

async function main() {
  const p = profile();
  console.log(`\n=== RGP QA seed  (profile: ${p.name}) ===`);

  const admin = await login(SEED.siteAdmin).catch((e) => {
    console.error(`Cannot reach API at ${process.env.QA_API_URL}. Is the stack up? (npm run stack:up)`);
    throw e;
  });

  const businesses = await GET<any[]>('/businesses', { token: admin });
  if (businesses.some((b) => b.name === MARKER) && !reset) {
    console.log('Marker business present - already seeded. Use --reset to add more, or `npm run stack:up` for a clean slate.');
    const existing = readManifest();
    if (existing) console.log(`manifest: ${JSON.stringify(existing.stats)}`);
    return;
  }

  const m: Manifest = {
    createdAt: new Date().toISOString(),
    profile: p.name,
    marker: MARKER,
    businesses: [], stores: [], users: [], roles: [],
    vendors: [], products: [], customers: [],
    purchaseOrders: [], invoices: [], sellableItems: [], sales: [],
    stats: {},
  };

  console.log('\n[1/4] catalogue (businesses, stores, users, roles, vendors, products, customers)');
  await buildCatalog(m);

  console.log('\n[2/4] stock in (purchase orders -> GRN)');
  await stockIn(m);

  console.log('\n[3/4] sales history (shifts, sales, returns, cash ledger)');
  await salesHistory(m);

  console.log('\n[4/4] marker + manifest');
  // create the marker business last so a crash mid-seed doesn't look "done"
  await import('./client.js').then(({ POST }) => POST('/businesses', { name: MARKER, isActive: false }, { token: admin }));
  writeManifest(m);

  console.log('\n=== seed complete ===');
  console.table(m.stats);
}

main()
  .catch((e) => {
    if (e instanceof ApiError) console.error(`\nAPI error: ${e.message}`);
    else console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
