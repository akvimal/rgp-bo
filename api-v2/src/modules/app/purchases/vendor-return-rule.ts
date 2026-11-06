/** Goods sent back to a vendor, with no database: what a line is worth, and what an invoice comes to once returns are adjusted on it. */
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ReturnLine { qty: number; rate: number; taxpcnt: number }

/** one line's credit: qty x rate before tax, and the GST on it */
export function returnLineValue(l: ReturnLine): { taxable: number; tax: number; total: number } {
  const taxable = r2((Number(l.qty) || 0) * (Number(l.rate) || 0));
  const tax = r2(taxable * (Number(l.taxpcnt) || 0) / 100);
  return { taxable, tax, total: r2(taxable + tax) };
}

/** the whole return's credit */
export function returnValue(lines: ReturnLine[]): { taxable: number; tax: number; total: number } {
  const v = lines.map(returnLineValue);
  const taxable = r2(v.reduce((s, x) => s + x.taxable, 0)), tax = r2(v.reduce((s, x) => s + x.tax, 0));
  return { taxable, tax, total: r2(taxable + tax) };
}

/** a problem with a return line, or '' when it is fine (qty is in sale units, as stock is) */
export function returnLineProblem(l: { qty: any; rate: any }, available: number, title: string): string {
  const qty = Number(l.qty);
  if (!Number.isInteger(qty) || qty <= 0) return `${title}: enter how many are going back.`;
  if (!(Number(l.rate) >= 0)) return `${title}: the credit rate cannot be negative.`;
  if (qty > available) return `${title}: only ${available} in stock in this batch, so ${qty} cannot go back.`;
  return '';
}

/** the invoice total after returns: what was bought (with GST) less the credits; a credit bigger than the purchase is refused */
export function netAfterCredits(net: number, credits: number): { net: number; problem: string } {
  const left = r2(net - credits);
  return left < 0
    ? { net: left, problem: `The returns adjusted on this invoice (${r2(credits).toFixed(2)}) are more than the goods bought (${r2(net).toFixed(2)}). Take a return off, or ask the vendor for a separate credit note.` }
    : { net: left, problem: '' };
}
