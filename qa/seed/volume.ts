/** Seed volume profiles. QA_SEED_PROFILE selects one. */
export interface Profile {
  name: string;
  extraBusinesses: number;       // on top of seed business 1 "RGP Pharmacy"
  storesPerBusiness: [number, number];
  storeHeadsPerStore: number;
  cashiersPerStore: number;
  vendors: number;
  products: number;
  pricedFraction: number;        // fraction of products that get a sale price + history
  customers: number;
  purchaseOrders: number;        // on store-1 catalogue
  salesWeeks: number;            // weeks of sales history on store 1
  shiftsPerWeek: number;
  salesPerShift: [number, number];
  returnFraction: number;
}

const REALISTIC: Profile = {
  name: 'realistic',
  extraBusinesses: 2,
  storesPerBusiness: [2, 3],
  storeHeadsPerStore: 1,
  cashiersPerStore: 2,
  vendors: 15,
  products: 800,
  pricedFraction: 0.85,
  customers: 150,
  purchaseOrders: 24,
  salesWeeks: 4,
  shiftsPerWeek: 12,
  salesPerShift: [8, 16],
  returnFraction: 0.06,
};

const SMALL: Profile = {
  name: 'small',
  extraBusinesses: 1,
  storesPerBusiness: [1, 2],
  storeHeadsPerStore: 1,
  cashiersPerStore: 1,
  vendors: 5,
  products: 120,
  pricedFraction: 0.9,
  customers: 30,
  purchaseOrders: 6,
  salesWeeks: 2,
  shiftsPerWeek: 5,
  salesPerShift: [4, 8],
  returnFraction: 0.08,
};

export function profile(): Profile {
  const p = (process.env.QA_SEED_PROFILE || 'realistic').toLowerCase();
  return p === 'small' ? SMALL : REALISTIC;
}
