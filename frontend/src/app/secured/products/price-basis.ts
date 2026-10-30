/**
 * Prices are stored per pack before GST. A business may show and type them with GST included ("what the customer pays"): these turn one into
 * the other. A price at the ceiling (the MRP less GST) is shown as the MRP itself, and what is typed can never go above the MRP.
 * The same two functions are in api-v2 pricing-mode.ts, tested there.
 */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ceilingOf = (mrp: number | null | undefined, tax: number) => (mrp && mrp > 0 ? Math.floor((mrp / (1 + tax / 100)) * 100 + 1e-6) / 100 : null);

export function priceWithGst(ex: number, tax: number, mrp?: number | null): number {
  const ceiling = ceilingOf(mrp, tax);
  if (mrp && ceiling !== null && Math.abs(ex - ceiling) < 0.005) return mrp;
  return r2(ex * (1 + tax / 100));
}

export function priceBeforeGst(withGst: number, tax: number, mrp?: number | null): number {
  const ceiling = ceilingOf(mrp, tax);
  const ex = r2(withGst / (1 + tax / 100));
  if (ceiling !== null && (withGst >= (mrp as number) - 0.005 || ex > ceiling)) return ceiling;
  return ex;
}
