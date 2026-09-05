/**
 * Catalogue: businesses, stores, users-per-role, custom roles, vendors,
 * products (+ price history), customers. All via the API.
 *
 * Scope rules (from the API): Site Admin creates only Business Heads (needs
 * businessid, no storeids); a Business Head creates only Store Head / Sales Staff
 * and its own stores. So: siteadmin -> business -> its BH -> login as BH -> stores + staff.
 */
import { GET, POST, login } from './client.js';
import { q } from './db.js';
import { SEED, PASSWORD, gen } from './personas.js';
import { profile } from './volume.js';
import { makeProduct, makeVendor, makeCustomer, salePrice, faker } from './pharma.js';
import { pool, progress, daysAgo, randInt } from './util.js';
import type { Manifest } from './manifest.js';

const ROLE = { businessHead: 1, salesStaff: 2, storeHead: 3, siteAdmin: 4 };

// permission blocks small enough to assert against in ROLE specs
const APPROVER_PERMS = [
  { resource: 'site', path: ['/secure/dashboard', '/secure/profile'] },
  { resource: 'purchases', path: ['/secure/purchases'], policies: [{ action: 'read' }] },
  { resource: 'purchaseorders', path: ['/secure/purchases/orders'], policies: [{ action: 'approve' }, { action: 'reject' }] },
];
const READONLY_PERMS = [
  { resource: 'site', path: ['/secure/dashboard', '/secure/profile'] },
  { resource: 'products', path: ['/secure/products'], policies: [{ action: 'read' }] },
  { resource: 'sales', path: ['/secure/sales/list'], policies: [{ action: 'read' }] },
];

export async function buildCatalog(m: Manifest) {
  const p = profile();
  const admin = await login(SEED.siteAdmin);
  const bhSeed = await login(SEED.businessHead);

  // --- businesses (seed business 1 "RGP Pharmacy" already exists) ---
  const existing = await GET<any[]>('/businesses', { token: admin });
  m.businesses = existing.map((b) => ({ id: b.id, name: b.name }));

  const bizNames = ['Northside Chemists', 'Harbour Health', 'Green Cross Pharmacy', 'Unity Medico'];
  for (let i = 0; i < p.extraBusinesses; i++) {
    const name = bizNames[i] ?? `QA Business ${i + 1}`;
    const b = await POST<any>('/businesses', { name, isActive: true }, { token: admin });
    const id = b?.id ?? (await GET<any[]>('/businesses', { token: admin })).find((x) => x.name === name)?.id;
    m.businesses.push({ id, name });
  }
  console.log(`  businesses: ${m.businesses.length} (${m.businesses.map((b) => b.name).join(', ')})`);

  // --- one Business Head per extra business, then login as them ---
  const bhByBiz = new Map<number, string>();
  bhByBiz.set(m.businesses[0].id, SEED.businessHead);
  for (const biz of m.businesses.slice(m.businesses.length - p.extraBusinesses)) {
    const slug = biz.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 8);
    const email = gen.businessHead(slug);
    await POST('/users', {
      fullname: `${biz.name} Head`, email, password: PASSWORD,
      phone: faker.string.numeric(10), location: biz.name, roleid: ROLE.businessHead, businessid: biz.id,
    }, { token: admin });
    bhByBiz.set(biz.id, email);
    const u = await GET<any[]>('/users', { token: admin });
    const rec = u.find((x) => x.email === email);
    m.users.push({ id: rec?.id, email, role: 'Business Head', businessId: biz.id, storeIds: [] });
  }

  // --- stores + staff per business ---
  for (const biz of m.businesses) {
    const bhEmail = bhByBiz.get(biz.id);
    if (!bhEmail) continue;
    const bhTok = await login(bhEmail);
    const slug = biz.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 8);

    // business 1 already has store 1 (from 006); still add more for multi-store cases
    const already = (await GET<any[]>('/stores', { token: bhTok })).filter((s) => s.business?.id === biz.id || s.businessid === biz.id);
    already.forEach((s) =>
      m.stores.push({ id: s.id, businessId: biz.id, location: s.location, depositThreshold: s.depositthreshold ?? s.deposit_threshold ?? 0 }),
    );

    const nStores = randInt(p.storesPerBusiness[0], p.storesPerBusiness[1]);
    for (let s = already.length; s < nStores; s++) {
      const location = `${biz.name.split(' ')[0]} ${['Central', 'East', 'West', 'Market Rd', 'Station'][s % 5]}`;
      const depositthreshold = randInt(8, 20) * 1000;
      await POST('/stores', { location, depositthreshold, isActive: true }, { token: bhTok });
    }
    const storesNow = (await GET<any[]>('/stores', { token: bhTok })).filter((s) => (s.business?.id ?? s.businessid) === biz.id);
    m.stores = m.stores.filter((s) => s.businessId !== biz.id);
    storesNow.forEach((s) =>
      m.stores.push({ id: s.id, businessId: biz.id, location: s.location, depositThreshold: s.depositthreshold ?? s.deposit_threshold ?? 0 }),
    );

    // staff: one store head + N cashiers per store (skip store 1 which has seed staff)
    for (const st of storesNow) {
      const seeded = st.id === 1;
      const heads = seeded ? 0 : p.storeHeadsPerStore;
      const cashiers = seeded ? 0 : p.cashiersPerStore;
      for (let h = 0; h < heads; h++) {
        const email = gen.storeHead(slug, st.id);
        await POST('/users', {
          fullname: `${st.location} Manager`, email, password: PASSWORD,
          phone: faker.string.numeric(10), location: st.location, roleid: ROLE.storeHead, storeids: [st.id],
        }, { token: bhTok });
        m.users.push({ id: 0, email, role: 'Store Head', businessId: biz.id, storeIds: [st.id], primaryStoreId: st.id });
      }
      for (let c = 0; c < cashiers; c++) {
        const email = gen.sales(slug, st.id * 10 + c);
        await POST('/users', {
          fullname: faker.person.fullName(), email, password: PASSWORD,
          phone: faker.string.numeric(10), location: st.location, roleid: ROLE.salesStaff, storeids: [st.id],
        }, { token: bhTok });
        m.users.push({ id: 0, email, role: 'Sales Staff', businessId: biz.id, storeIds: [st.id], primaryStoreId: st.id });
      }
    }
  }
  // fill user ids (from DB - scoped API lists don't show every business's users)
  const rows = await q<{ id: number; email: string }>('SELECT id, email FROM app_user');
  const byEmail = new Map(rows.map((r) => [r.email, r.id]));
  m.users.forEach((u) => { if (byEmail.has(u.email)) u.id = byEmail.get(u.email)!; });
  console.log(`  stores: ${m.stores.length}   generated users: ${m.users.length}`);

  // --- custom roles for ROLE-* specs ---
  for (const [slug, name, perms] of [
    ['approver', 'QA PO Approver', APPROVER_PERMS],
    ['readonly', 'QA Read Only', READONLY_PERMS],
  ] as const) {
    const r = await POST<any>('/roles', { name, permissions: perms, locked: false }, { token: bhSeed });
    const id = r?.id ?? (await GET<any[]>('/roles', { token: bhSeed })).find((x) => x.name === name)?.id;
    m.roles.push({ id, name, slug });
    // A user holding exactly that role. The API's user endpoints only allow the 4
    // built-in roles, so create as Sales Staff then re-point role_id directly
    // (test-data setup; the ROLE-* specs assert the runtime effect of the role).
    const email = gen.roleOnly(slug);
    await POST('/users', {
      fullname: name, email, password: PASSWORD, phone: faker.string.numeric(10),
      location: 'RGP Pharmacy', roleid: ROLE.salesStaff, storeids: [1],
    }, { token: bhSeed });
    const uid = (await GET<any[]>('/users', { token: bhSeed })).find((x) => x.email === email)?.id;
    if (uid && id) await q('UPDATE app_user SET role_id = $1 WHERE id = $2', [id, uid]);
    m.users.push({ id: uid ?? 0, email, role: name, businessId: 1, storeIds: [1], primaryStoreId: 1 });
  }
  console.log(`  custom roles: ${m.roles.map((r) => r.name).join(', ')}`);

  // --- vendors ---
  const vTick = progress('vendors', p.vendors);
  m.vendors = await pool(Array.from({ length: p.vendors }, (_, i) => i), 8, async (i) => {
    const v = await POST<any>('/vendors', makeVendor(i + 1), { token: bhSeed });
    vTick();
    return v?.id;
  });
  m.vendors = m.vendors.filter(Boolean);

  // --- products + price history ---
  const pTick = progress('products', p.products);
  const idxs = Array.from({ length: p.products }, (_, i) => i);
  m.products = await pool(idxs, 10, async (i) => {
    const spec = makeProduct(i + 1);
    const prod = await POST<any>('/products', spec, { token: bhSeed });
    const id = prod?.id;
    let priced = false;
    if (id && Math.random() < p.pricedFraction) {
      const { price } = salePrice(spec.taxpcnt);
      // one clean price row - repeated prices/add with past effdates produces
      // overlapping/inverted date ranges (see PROD-8 finding)
      await POST('/products/prices/add', {
        productid: id, saleprice: price, effdate: daysAgo(20),
        reason: 'Initial', comments: 'qa-seed',
      }, { token: bhSeed }).catch(() => {});
      priced = true;
    }
    pTick();
    return { id, title: spec.title, priced };
  });
  m.products = m.products.filter((x) => x.id);

  // --- customers ---
  const cTick = progress('customers', p.customers);
  m.customers = await pool(Array.from({ length: p.customers }, (_, i) => i), 10, async (i) => {
    const c = await POST<any>('/customers', makeCustomer(i + 1), { token: bhSeed });
    cTick();
    return c?.id;
  });
  m.customers = m.customers.filter(Boolean);

  m.stats.businesses = m.businesses.length;
  m.stats.stores = m.stores.length;
  m.stats.users = m.users.length;
  m.stats.vendors = m.vendors.length;
  m.stats.products = m.products.length;
  m.stats.pricedProducts = m.products.filter((x) => x.priced).length;
  m.stats.customers = m.customers.length;
}
