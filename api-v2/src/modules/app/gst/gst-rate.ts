/**
 * GST rates that change on a date. A change covers all products, a category, an HSN prefix or one product, and either sets the rate or caps it.
 * The most specific change in force on the bill date wins; with none, the batch's own GST is billed. This file mirrors the database function
 * gst_sale_rate() so a change can be previewed before it is saved; billing itself asks the database.
 */

export type ScopeType = 'all' | 'category' | 'hsn_prefix' | 'product';
export type ChangeMode = 'set' | 'cap';
export type PricePolicy = 'pass_saving' | 'keep_price';

export interface RateChange {
  id?: number;
  scope_type: ScopeType;
  scope_value: string;
  mode: ChangeMode;
  rate: number;
  effective_from: string;
  price_policy?: PricePolicy;
  note?: string | null;
}

export interface ProductFacts {
  id: number;
  category: string | null;
  hsn: string | null;
  /** the category's default HSN, provisional until the Business Head confirms it */
  categoryHsn: string | null;
}

export const SCOPE_TYPES: ScopeType[] = ['all', 'category', 'hsn_prefix', 'product'];

const clean = (v: any) => String(v ?? '').trim();

/** the product's own HSN, else its category's default (null when neither is known) */
export function effectiveHsn(p: ProductFacts): { hsn: string | null; source: 'own' | 'category' | 'none' } {
  const own = clean(p.hsn);
  if (own) return { hsn: own, source: 'own' };
  const def = clean(p.categoryHsn);
  if (def) return { hsn: def, source: 'category' };
  return { hsn: null, source: 'none' };
}

export function applyChange(mode: ChangeMode, rate: number, batchTax: number): number {
  return mode === 'set' ? rate : Math.min(Number(batchTax) || 0, rate);
}

export function matches(c: RateChange, p: ProductFacts): boolean {
  switch (c.scope_type) {
    case 'all': return true;
    case 'product': return clean(c.scope_value) === String(p.id);
    case 'category': return clean(c.scope_value).toLowerCase() === clean(p.category).toLowerCase();
    case 'hsn_prefix': {
      const h = effectiveHsn(p).hsn;
      return !!h && h.startsWith(clean(c.scope_value));
    }
  }
  return false;
}

const specificity = (c: RateChange) => ({ product: 4, hsn_prefix: 3, category: 2, all: 1 }[c.scope_type]);

/** the change that decides the rate for this product on this day, or null */
export function winner(changes: RateChange[], p: ProductFacts, on: string): RateChange | null {
  const live = changes.filter((c) => c.effective_from <= on && matches(c, p));
  if (!live.length) return null;
  live.sort((a, b) =>
    specificity(b) - specificity(a)
    || (b.scope_type === 'hsn_prefix' ? clean(b.scope_value).length : 0) - (a.scope_type === 'hsn_prefix' ? clean(a.scope_value).length : 0)
    || (a.effective_from < b.effective_from ? 1 : a.effective_from > b.effective_from ? -1 : 0)
    || (b.id ?? 0) - (a.id ?? 0));
  return live[0];
}

/** the GST billed for a product on a day */
export function rateOn(changes: RateChange[], p: ProductFacts, batchTax: number, on: string): number {
  const w = winner(changes, p, on);
  return w ? applyChange(w.mode, w.rate, batchTax) : Number(batchTax) || 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

/**
 * What a rate change does to one pack's price. The list price is without GST and the bill adds the GST billed, so:
 *  - pass the saving on: nothing is repriced; the customer pays the same price plus the new, lower GST;
 *  - keep the price: the price without GST rises so the customer still pays what they paid, but never above the MRP less the new GST.
 */
export function priceImpact(price: number | null, mrp: number | null, oldRate: number, newRate: number) {
  if (price === null || !(price > 0)) return { price: null, now: null, pass: null, keep: null };
  const now = Math.min(price * (1 + oldRate / 100), mrp && mrp > 0 ? mrp : Infinity);
  const pass = { price: r2(price), customer: r2(price * (1 + newRate / 100)) };
  const ceiling = mrp && mrp > 0 ? floor2(mrp / (1 + newRate / 100)) : null;
  let keepPrice = floor2(now / (1 + newRate / 100));
  if (keepPrice < price) keepPrice = price;
  let capped = false;
  if (ceiling !== null && keepPrice > ceiling) { keepPrice = ceiling; capped = true; }
  const keep = { price: r2(keepPrice), customer: r2(keepPrice * (1 + newRate / 100)), capped };
  return { price: r2(price), now: r2(now), pass, keep };
}

const isDay = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

/** checks what the Business Head sends for a new change; returns the clean change or the reason it is refused */
export function parseChange(body: any): { value?: RateChange & { price_policy: PricePolicy }; error?: string } {
  const scope = clean(body?.scope_type) as ScopeType;
  if (!SCOPE_TYPES.includes(scope)) return { error: 'Choose what the change covers: all products, a category, an HSN prefix or one product.' };
  let value = clean(body?.scope_value);
  if (scope === 'all') value = '';
  else if (!value) return { error: 'Say which category, HSN prefix or product the change covers.' };
  if (scope === 'hsn_prefix' && !/^\d{2,8}$/.test(value)) return { error: 'An HSN prefix is 2 to 8 digits.' };
  if (scope === 'product' && !/^\d+$/.test(value)) return { error: 'Choose the product.' };
  if (scope === 'category' && value.length > 100) return { error: 'That category name is too long.' };
  const mode = clean(body?.mode) as ChangeMode;
  if (mode !== 'set' && mode !== 'cap') return { error: 'Choose whether the change sets the rate or caps it.' };
  const rate = Number(body?.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 40) return { error: 'The rate must be between 0 and 40 percent.' };
  const eff = clean(body?.effective_from);
  if (!isDay(eff)) return { error: 'Give the date the change takes effect.' };
  const policy = (clean(body?.price_policy) || 'pass_saving') as PricePolicy;
  if (policy !== 'pass_saving' && policy !== 'keep_price') return { error: 'Choose pass the saving on or keep the price.' };
  const note = clean(body?.note);
  if (note.length > 300) return { error: 'The note can be at most 300 characters.' };
  return { value: { scope_type: scope, scope_value: value, mode, rate: Math.round(rate * 100) / 100, effective_from: eff, price_policy: policy, note: note || null } };
}

/** an HSN as entered: 4, 6 or 8 digits */
export function parseHsn(v: any): { value?: string; error?: string } {
  const s = clean(v).replace(/\s+/g, '');
  if (!/^\d{4}(\d{2}){0,2}$/.test(s)) return { error: 'An HSN code is 4, 6 or 8 digits.' };
  return { value: s };
}
