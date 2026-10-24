/**
 * The printed price list a shop sells from when the system is down. A customer pays the price plus GST, and may never be charged more than the MRP,
 * so each line is the price WITH GST, per pack and per unit (one tablet), kept within the lowest MRP among the batches in stock.
 * Units as everywhere: the stored price is per pack and without GST; the MRP includes GST; the till bills at most the GST in `tmax`.
 */
export interface PriceListInput {
  id: number;
  title: string;
  pack: number;
  sched: string | null;      // schedule: H, H1, X or none
  price_ex: number;          // current price, per pack, without GST
  min_mrp: number;           // the lowest MRP (per pack) among the batches in stock
  tmax: number;              // the highest GST billed among those batches
}

export interface PriceListEntry {
  id: number;
  title: string;
  pack: number;
  packIncl: number;          // what a customer pays for a pack
  unitIncl: number;          // what a customer pays for one unit
  mrp: number;               // the MRP of a pack
  rx: boolean;               // prescription only (Schedule H, H1 or X)
  capped: boolean;           // the price had to be brought down to stay within the MRP
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

/** one line, or null when the product cannot be priced for the counter (no pack, no price, no MRP) */
export function priceListEntry(r: PriceListInput): PriceListEntry | null {
  const pack = Number(r.pack), price = Number(r.price_ex), mrp = Number(r.min_mrp), t = Number(r.tmax) || 0;
  if (!(pack > 0) || !(price > 0) || !(mrp > 0)) return null;
  const ceiling = floor2(mrp / (1 + t / 100));
  const capped = price > ceiling + 0.005;
  const ex = capped ? ceiling : price;
  // the same arithmetic as the till: the unit price is the pack price over the pack, to two places, then GST is added
  const packIncl = Math.min(r2(ex * (1 + t / 100)), mrp);
  const unitEx = r2(ex / pack);
  const unitIncl = pack === 1 ? packIncl : Math.min(r2(unitEx * (1 + t / 100)), floor2(mrp / pack));
  return {
    id: r.id, title: String(r.title).trim(), pack, packIncl, unitIncl, mrp: r2(mrp),
    rx: ['H', 'H1', 'X'].includes(String(r.sched ?? '').trim().toUpperCase()), capped,
  };
}

/** the whole list, alphabetical by title, without the products that cannot be priced */
export function buildPriceList(rows: PriceListInput[]): PriceListEntry[] {
  return rows
    .map(priceListEntry)
    .filter((e): e is PriceListEntry => e !== null)
    .sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }));
}
