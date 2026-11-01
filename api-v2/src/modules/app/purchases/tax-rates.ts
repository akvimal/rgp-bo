/**
 * The tax rates a purchase invoice line can carry. A business buys at a few rates (a pharmacy at 0, 5 and 18), so the line offers those instead of a free
 * number. The list is a setting (purchase_tax_rates, such as "0,5,18"); when it is empty the usual rates of the business type apply.
 */
export const DEFAULT_TAX_RATES = '0,5,12,18,28';
export const TAX_RATES_BY_TYPE: Record<string, string> = { pharmacy: '0,5,18' };

/** a list of rates as numbers from 0 to 100, without repeats, in order; anything unreadable is left out */
export function parseTaxRates(raw: any): number[] {
  const out = new Set<number>();
  for (const part of String(raw ?? '').split(/[,\s;]+/)) {
    if (!part.trim()) continue;
    const n = Number(part.replace('%', ''));
    if (Number.isFinite(n) && n >= 0 && n <= 100) out.add(Math.round(n * 100) / 100);
  }
  return [...out].sort((a, b) => a - b);
}

/** the rates to offer: the business's own list if it has one, else the type's usual rates, else the general ones */
export function taxRatesFor(setting: any, businessType: string | null | undefined): number[] {
  const own = parseTaxRates(setting);
  if (own.length) return own;
  const usual = parseTaxRates(TAX_RATES_BY_TYPE[String(businessType ?? '').toLowerCase()] ?? DEFAULT_TAX_RATES);
  return usual.length ? usual : parseTaxRates(DEFAULT_TAX_RATES);
}
