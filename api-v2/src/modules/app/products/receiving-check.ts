/**
 * Two questions about a purchase line at receiving. Pure, relative imports only.
 *  - How far above its cost the printed MRP is: an MRP many times the rate (without GST) is usually an inflated printed MRP, and selling near it would
 *    show customers a discount that is not real.
 *  - The best margin the line can give: selling at the MRP (without GST) leaves this markup on the cost. When even that is below the business's minimum
 *    for the product's class, the line cannot be priced profitably.
 */
export const DEFAULT_MRP_RATE_RATIO = 6;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** the MRP without GST divided by the net cost per pack; null when either is missing */
export function mrpRatio(mrp: number, saleTax: number, cost: number): number | null {
  if (!(mrp > 0) || !(cost > 0)) return null;
  return r2(mrp / (1 + Math.max(0, saleTax) / 100) / cost);
}

/** the markup on cost that selling at the MRP (without GST) gives; null when cost or MRP is missing */
export function bestMarkupPct(mrp: number, saleTax: number, cost: number): number | null {
  if (!(mrp > 0) || !(cost > 0)) return null;
  return r2((mrp / (1 + Math.max(0, saleTax) / 100) / cost - 1) * 100);
}

/** a setting read as the flag ratio (2 to 50), else the default */
export function ratioSetting(raw: any): number {
  const n = Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 2 && n <= 50 ? n : DEFAULT_MRP_RATE_RATIO;
}
