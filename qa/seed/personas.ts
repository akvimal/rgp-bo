/**
 * Login identities. The 5 seed accounts come from sql/ddl/006_dev_test_data.sql
 * (all share password QA_ADMIN_PASS = "admin123"). Generated business heads /
 * store staff are written into the manifest by the catalog step and loaded here.
 */
export const SEED = {
  siteAdmin:    'siteadmin@local.test',    // role 4 Site Admin  (business 1 scope)
  businessHead: 'businesshead@local.test',  // role 1 Business Head, business 1 "RGP Pharmacy"
  storeHead:    'storehead@local.test',     // role 3 Store Head,   store 1
  sales1:       'sales1@local.test',        // role 2 Sales Staff,  store 1
  sales2:       'sales2@local.test',        // role 2 Sales Staff,  store 1
} as const;

export const PASSWORD = process.env.QA_ADMIN_PASS || 'admin123';

/** stable email pattern for generated users so specs can predict them */
export const gen = {
  businessHead: (slug: string) => `bh.${slug}@qa.local`,
  storeHead: (slug: string, n: number) => `sh.${slug}${n}@qa.local`,
  sales: (slug: string, n: number) => `cashier.${slug}${n}@qa.local`,
  roleOnly: (slug: string) => `role.${slug}@qa.local`,
};
