/** Loads seed/manifest.json and exposes helpers to resolve seeded entities. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Manifest, StoreRef, UserRef } from '../seed/manifest.js';

const PATH = join(process.cwd(), 'seed', 'manifest.json');

let cached: Manifest | null = null;

export function manifest(): Manifest {
  if (cached) return cached;
  if (!existsSync(PATH)) {
    throw new Error('seed/manifest.json missing - run `npm run seed` first.');
  }
  cached = JSON.parse(readFileSync(PATH, 'utf8')) as Manifest;
  return cached;
}

export const data = {
  get m() { return manifest(); },

  business(name: string) {
    const b = manifest().businesses.find((x) => x.name === name);
    if (!b) throw new Error(`no seeded business "${name}"`);
    return b;
  },
  /** a business that is NOT business 1 (for cross-business isolation checks) */
  otherBusiness() {
    return manifest().businesses.find((b) => b.id !== 1)!;
  },
  storesOf(businessId: number): StoreRef[] {
    return manifest().stores.filter((s) => s.businessId === businessId);
  },
  user(pred: (u: UserRef) => boolean): UserRef {
    const u = manifest().users.find(pred);
    if (!u) throw new Error('no seeded user matches predicate');
    return u;
  },
  /** a Sales Staff user assigned to exactly one store (CTX-1) */
  singleStoreCashier() {
    return this.user((u) => u.role === 'Sales Staff' && u.storeIds.length === 1);
  },
  roleHolder(slug: 'approver' | 'readonly') {
    const role = manifest().roles.find((r) => r.slug === slug);
    return this.user((u) => u.role === role?.name);
  },
  anyCustomer() { return manifest().customers[0]; },
};
