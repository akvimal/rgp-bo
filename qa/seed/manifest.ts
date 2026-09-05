/**
 * The seed manifest is the contract between the generator and the specs:
 * stable aliases -> ids/logins the specs can rely on. Written by seed/run.ts,
 * read by fixtures/data.fixture.ts.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = join(HERE, 'manifest.json');

export interface StoreRef { id: number; businessId: number; location: string; depositThreshold: number; }
export interface UserRef { id: number; email: string; role: string; businessId?: number; storeIds: number[]; primaryStoreId?: number; }
export interface BusinessRef { id: number; name: string; }

export interface Manifest {
  createdAt: string;
  profile: string;
  marker: string;                       // marker business name -> idempotency
  businesses: BusinessRef[];
  stores: StoreRef[];
  users: UserRef[];                      // generated users only (seed users are in personas.ts)
  roles: { id: number; name: string; slug: string }[];
  vendors: number[];
  products: { id: number; title: string; priced: boolean }[];
  customers: number[];
  purchaseOrders: { id: number; approved: boolean }[];
  invoices: { id: number; confirmed: boolean }[];
  sellableItems: { itemid: number; productid: number; batch: string; price: number; mrpcost: number; taxpcnt: number }[];
  sales: { id: number; total: number; cash: number; digital: number }[];
  stats: Record<string, number>;
}

export function readManifest(): Manifest | null {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

export function writeManifest(m: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}
