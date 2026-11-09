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

/**
 * Whether returns can be adjusted on (or taken off) an invoice: while it is a draft, and also once it is completed as long as nothing has been paid on it
 * (the amount payable simply comes down). A payment recorded against it fixes the amount, so a credit can no longer move it.
 */
export function creditsEditable(status: string, paid: number): { editable: boolean; reason: string } {
  if (status === 'NEW') return { editable: true, reason: '' };
  if (status !== 'COMPLETE') return { editable: false, reason: 'Returns can be adjusted only on a draft or a completed invoice.' };
  if (Math.abs(Number(paid) || 0) > 0.005) return { editable: false, reason: 'A payment has been recorded on this invoice, so a return can no longer be adjusted on it. Adjust it on the next invoice from this vendor.' };
  return { editable: true, reason: '' };
}

/** the invoice total after returns: what was bought (with GST) less the credits; a credit bigger than the purchase is refused */
export function netAfterCredits(net: number, credits: number): { net: number; problem: string } {
  const left = r2(net - credits);
  return left < 0
    ? { net: left, problem: `The returns adjusted on this invoice (${r2(credits).toFixed(2)}) are more than the goods bought (${r2(net).toFixed(2)}). Take a return off, or ask the vendor for a separate credit note.` }
    : { net: left, problem: '' };
}
