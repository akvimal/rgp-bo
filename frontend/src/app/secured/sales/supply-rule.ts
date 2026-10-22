/**
 * A month's requirement of a medicine, in units: the product's own `monthly_units` if it has one, otherwise 30 (one a day) for a
 * chronic medicine, otherwise none (a one-off purchase has no monthly requirement). Mirrors api-v2 sales/batch-rules.ts.
 */
export const DEFAULT_MONTHLY_UNITS = 30;

export function monthlyUnits(item: any): number {
  const props = item?.more_props || item?.props || {};
  const own = Number(props.monthly_units);
  if (Number.isFinite(own) && own > 0) return own;
  return String(props.chronic) === "true" ? DEFAULT_MONTHLY_UNITS : 0;
}

/** months this line's quantity covers (0 when the product has no monthly requirement) */
export function monthsCovered(item: any): number {
  const m = monthlyUnits(item);
  return m > 0 ? (+item.qty || 0) / m : 0;
}
