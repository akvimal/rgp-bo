/**
 * The money of a purchase invoice, with no database. A line's stored `total` is its amount BEFORE tax: qty x rate x (1 - discount).
 * GST is worked out on top of it, the invoice comes to the lines plus their GST (less a cash discount printed at the foot), and the
 * rounding remainder is what the invoice's round_off column keeps. (The GST used to be taken OUT of the line total, as if it were
 * already inside, which understated the taxable value and the GST, and the invoice total left GST out altogether.)
 */
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LineGst { taxablevalue: number; cgstamount: number; sgstamount: number; igstamount: number }

/** the GST split of one line whose `total` is before tax: CGST and SGST for supply within the state, IGST between states */
export function lineGst(total: number, taxpcnt: any, supplytype: string): LineGst {
  const pcnt = Number(taxpcnt || 0);
  const taxablevalue = r2(Number(total) || 0);
  const taxamount = pcnt > 0 ? r2(taxablevalue * pcnt / 100) : 0;
  if (supplytype === 'INTER') return { taxablevalue, cgstamount: 0, sgstamount: 0, igstamount: taxamount };
  const half = r2(taxamount / 2);
  return { taxablevalue, cgstamount: half, sgstamount: r2(taxamount - half), igstamount: 0 };
}

/** a cash discount printed at the foot comes off the goods before tax: every line is scaled by what is left (1 when there is none) */
export function cashFactor(goods: number, cashDiscount: number): number {
  return cashDiscount > 0 && goods > cashDiscount ? (goods - cashDiscount) / goods : 1;
}

export interface Net { goods: number; tax: number; net: number }

/** what an invoice comes to: its lines before tax, the GST on them, and the total less any cash discount */
export function invoiceNet(lines: { total: any; taxpcnt: any }[], cashDiscount: any = 0): Net {
  const goods = lines.reduce((s, l) => s + (Number(l.total) || 0), 0);
  const gross = lines.reduce((s, l) => s + (Number(l.total) || 0) * (1 + (Number(l.taxpcnt) || 0) / 100), 0);
  const f = cashFactor(goods, Number(cashDiscount) || 0);
  return { goods: r2(goods), tax: r2((gross - goods) * f), net: r2(gross * f) };
}

export interface GstHeader { taxablevalue: number; cgstamount: number; sgstamount: number; igstamount: number; roundoff: number }

/**
 * The GST figures kept on the invoice header: the lines' taxable value and GST added up, each scaled by the cash discount printed at
 * the foot (it comes off the goods before tax, so the taxable value and the GST fall with it, the same as the total does), and the
 * round-off, which is what is left between the total and those figures.
 */
export function invoiceGstHeader(
  lines: { total: any; taxablevalue: any; cgstamount: any; sgstamount: any; igstamount: any }[],
  cashDiscount: any,
  total: any,
): GstHeader {
  const goods = lines.reduce((s, l) => s + (Number(l.total) || 0), 0);
  const f = cashFactor(goods, Number(cashDiscount) || 0);
  const sum = (k: 'taxablevalue' | 'cgstamount' | 'sgstamount' | 'igstamount') => r2(lines.reduce((s, l) => s + (Number(l[k]) || 0), 0) * f);
  const taxablevalue = sum('taxablevalue'), cgstamount = sum('cgstamount'), sgstamount = sum('sgstamount'), igstamount = sum('igstamount');
  return { taxablevalue, cgstamount, sgstamount, igstamount, roundoff: r2((Number(total) || 0) - (taxablevalue + cgstamount + sgstamount + igstamount)) };
}

/** how far the lines may come from the net total printed on the vendor's invoice: the rounding at its foot and the paise on each line */
export const PRINTED_TOLERANCE = 1;

/** the lines agree with the printed net total (or no total was entered) */
export function agreesWithPrinted(printed: any, billedNet: number): boolean {
  const p = Number(printed) || 0;
  return !(p > 0) || Math.abs(billedNet - p) <= PRINTED_TOLERANCE + 1e-9;
}

/**
 * What is payable once the lines agree with the printed net total: exactly that total, less what came off it since (lines the vendor has
 * agreed to drop, and credits for returns). With nothing taken off, the payable is the printed total to the paisa.
 */
export function payableFromPrinted(printed: number, billedNet: number, liveNet: number, credits: number): number {
  return r2(Math.max(0, Number(printed) + (Number(liveNet) - Number(billedNet)) - Number(credits)));
}
