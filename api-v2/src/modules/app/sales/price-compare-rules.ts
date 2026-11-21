import { formRelation } from '../dictionary/dosage-form';

/**
 * Pure rules for comparing the shop's prices with the loaded price lists (the PMBI Jan Aushadhi list and other sellers' lists) for the same composition.
 * Everything is compared per unit (a tablet, a capsule), so packs of different sizes line up; a list item whose pack is a volume or a weight (60 ml, 15 g)
 * has no unit to compare and is shown with its pack price only. The shop's price is what the customer pays: with GST, never above the MRP.
 */

export interface RefItem {
  sourceId: number; sourceName: string; kind: string; name: string; unitSize: string | null; packQty: number | null; packKind: string;
  mrp: number; sellPrice: number | null; composition: string | null; form: string | null;
}

export interface RefUnit { unitMrp: number | null; unitSell: number | null; perUnit: boolean }

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** a list item per unit: the MRP, and the price it is sold at (the PMBI list sells at its MRP; another list's own selling price, or none) */
export function refUnit(i: RefItem): RefUnit {
  if (i.packKind !== 'units' || !(Number(i.packQty) > 0)) return { unitMrp: null, unitSell: null, perUnit: false };
  const q = Number(i.packQty);
  const sell = i.sellPrice !== null && i.sellPrice !== undefined ? Number(i.sellPrice) : i.kind === 'PMBI' ? Number(i.mrp) : null;
  return { unitMrp: r4(Number(i.mrp) / q), unitSell: sell === null ? null : r4(sell / q), perUnit: true };
}

/** what the customer pays for one pack: the price before GST with GST added, never above the MRP */
export function customerPrice(priceExGst: number | null | undefined, saleTax: number, mrp: number): number | null {
  if (priceExGst === null || priceExGst === undefined || !(Number(priceExGst) > 0)) return null;
  const withGst = Number(priceExGst) * (1 + (Number(saleTax) || 0) / 100);
  return r2(mrp > 0 ? Math.min(withGst, mrp) : withGst);
}

/** how much dearer (+) or cheaper (-) the shop is than a reference price, in percent; none when either price is missing */
export function gapPct(ours: number | null, theirs: number | null): number | null {
  if (ours === null || theirs === null || !(theirs > 0)) return null;
  return Math.round(((ours - theirs) / theirs) * 1000) / 10;
}

export interface SourceSummary {
  sourceId: number; sourceName: string; kind: string; items: number;
  unitMrp: { min: number; max: number } | null;
  unitSell: { min: number; max: number } | null;
  /** the item with the lowest selling price per unit (the PMBI item for the PMBI list) */
  cheapest: { name: string; unitSize: string | null; unitSell: number; mrp: number } | null;
  /** items whose pack has no unit to compare (a bottle in ml, a tube in g) */
  perPackOnly: { name: string; unitSize: string | null; mrp: number; sellPrice: number | null }[];
  /** the shop's gap against the cheapest selling price in this list, percent (+ the shop is dearer) */
  gap: number | null;
}

/** the items of one composition grouped by list, with the ones of a different known dosage form left out */
export function summarise(items: RefItem[], ourForm: string | null, ourUnitPrice: number | null): SourceSummary[] {
  const by = new Map<number, RefItem[]>();
  for (const i of items) if (formRelation(ourForm, i.form) !== 'different') { const g = by.get(i.sourceId) || []; g.push(i); by.set(i.sourceId, g); }
  const out: SourceSummary[] = [];
  by.forEach((list) => {
    const units = list.map((i) => ({ i, u: refUnit(i) }));
    const withUnit = units.filter((x) => x.u.perUnit);
    const mrps = withUnit.map((x) => x.u.unitMrp as number);
    const sells = withUnit.filter((x) => x.u.unitSell !== null);
    const cheapest = sells.length ? sells.reduce((a, b) => ((b.u.unitSell as number) < (a.u.unitSell as number) ? b : a)) : null;
    out.push({
      sourceId: list[0].sourceId, sourceName: list[0].sourceName, kind: list[0].kind, items: list.length,
      unitMrp: mrps.length ? { min: r2(Math.min(...mrps)), max: r2(Math.max(...mrps)) } : null,
      unitSell: sells.length ? { min: r2(Math.min(...sells.map((x) => x.u.unitSell as number))), max: r2(Math.max(...sells.map((x) => x.u.unitSell as number))) } : null,
      cheapest: cheapest ? { name: cheapest.i.name, unitSize: cheapest.i.unitSize, unitSell: r2(cheapest.u.unitSell as number), mrp: cheapest.i.mrp } : null,
      perPackOnly: units.filter((x) => !x.u.perUnit).map((x) => ({ name: x.i.name, unitSize: x.i.unitSize, mrp: x.i.mrp, sellPrice: x.i.sellPrice })),
      gap: cheapest ? gapPct(ourUnitPrice, cheapest.u.unitSell as number) : null,
    });
  });
  // the PMBI list first, then the others by name
  return out.sort((a, b) => (a.kind === 'PMBI' ? 0 : 1) - (b.kind === 'PMBI' ? 0 : 1) || a.sourceName.localeCompare(b.sourceName));
}

/** the biggest gap in the shop's disfavour across the lists (the shop dearer than the cheapest list by this much), for sorting; none when nothing compares */
export function worstGap(summaries: SourceSummary[]): number | null {
  const gaps = summaries.map((s) => s.gap).filter((g): g is number => g !== null);
  return gaps.length ? Math.max(...gaps) : null;
}
