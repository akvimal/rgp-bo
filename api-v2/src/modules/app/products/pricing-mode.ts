import { boundsOf, ClassPolicy, PolicySettings, Subject, suggestPrice } from './price-policy';

/**
 * How a business prices its goods, in the words an owner uses. It sits in front of the class rules of price-policy.ts and only changes the
 * limits those rules are given, so the review queue, the price dialog, the purchase check and the till all follow it:
 *   MRP       every product sells at its MRP (nothing below it, nothing above); a new MRP is followed at once.
 *   DISCOUNT  a usual discount off the MRP for a new price, a deepest discount allowed, and an optional minimum margin over cost.
 *   SMART     the nine class rules (trade margin band x profit rank) with stepped raises: how the app has always worked.
 * Whether prices are shown and typed with GST included ("what the customer pays") or before GST is a separate choice.
 * Pure: the services pass in the stored settings.
 */
export type PricingMode = 'MRP' | 'DISCOUNT' | 'SMART';
export type PriceBasis = 'incl' | 'excl';

export interface ModeSettings {
  mode: PricingMode;
  basis: PriceBasis;
  discountPct: number;       // DISCOUNT: the usual discount off the MRP, for a product's first price
  maxDiscountPct: number;    // DISCOUNT: the deepest discount any price may have
  minMarginPct: number;      // DISCOUNT: the lowest markup on cost
}

export const MODES: PricingMode[] = ['MRP', 'DISCOUNT', 'SMART'];
export const MODE_DEFAULTS: ModeSettings = { mode: 'SMART', basis: 'excl', discountPct: 10, maxDiscountPct: 15, minMarginPct: 0 };

/** the keys under category 'pricing' in app_setting */
export const MODE_KEYS = { mode: 'pricing_mode', basis: 'price_basis', discountPct: 'mode_discount_pct', maxDiscountPct: 'mode_max_discount_pct', minMarginPct: 'mode_min_margin_pct' } as const;

const num = (rows: Array<{ setting_key: string; setting_value: any }>, key: string, d: number) => {
  const raw = rows.find((r) => r.setting_key === key)?.setting_value;
  const n = Number(raw);
  return raw !== undefined && raw !== null && raw !== '' && Number.isFinite(n) && n >= 0 ? n : d;
};

/** the stored settings; anything missing or unknown is how the app worked before modes existed (SMART, before GST) */
export function readModeSettings(rows: Array<{ setting_key: string; setting_value: any }>): ModeSettings {
  const mode = String(rows.find((r) => r.setting_key === MODE_KEYS.mode)?.setting_value ?? '').toUpperCase();
  const basis = String(rows.find((r) => r.setting_key === MODE_KEYS.basis)?.setting_value ?? '').toLowerCase();
  return {
    mode: (MODES as string[]).includes(mode) ? (mode as PricingMode) : MODE_DEFAULTS.mode,
    basis: basis === 'incl' ? 'incl' : 'excl',
    discountPct: num(rows, MODE_KEYS.discountPct, MODE_DEFAULTS.discountPct),
    maxDiscountPct: num(rows, MODE_KEYS.maxDiscountPct, MODE_DEFAULTS.maxDiscountPct),
    minMarginPct: num(rows, MODE_KEYS.minMarginPct, MODE_DEFAULTS.minMarginPct),
  };
}

/** the limits a class is held to under this mode (SMART keeps the stored class row) */
export function effectivePolicy(ms: ModeSettings, stored: ClassPolicy): ClassPolicy {
  if (ms.mode === 'MRP') return { floorMarkupPct: 0, maxDiscountPct: 0, usualDiscountPct: 0 };
  if (ms.mode === 'DISCOUNT') return { floorMarkupPct: ms.minMarginPct, maxDiscountPct: ms.maxDiscountPct, usualDiscountPct: ms.discountPct };
  return stored;
}

/** a price that is below its MRP is raised to it in one step under MRP: the price on the pack is what the customer sees, so there is nothing to ease in */
export function effectiveSteps(ms: ModeSettings, st: PolicySettings): PolicySettings {
  return ms.mode === 'MRP' ? { ...st, stepPricePct: 100000, stepMrpPct: 100000, stepDays: 0 } : st;
}

/** what a body from the screen may change; the rest stays as stored */
export function validateModeSettings(body: any, current: ModeSettings): { value?: ModeSettings; error?: string } {
  const next: ModeSettings = { ...current };
  if (body?.mode !== undefined) {
    const m = String(body.mode).toUpperCase();
    if (!(MODES as string[]).includes(m)) return { error: 'Choose how you price: at the MRP, a discount off the MRP, or smart groups.' };
    next.mode = m as PricingMode;
  }
  if (body?.basis !== undefined) {
    const b = String(body.basis).toLowerCase();
    if (b !== 'incl' && b !== 'excl') return { error: 'Choose whether prices include GST or are before GST.' };
    next.basis = b;
  }
  const pct = (v: any, label: string, max: number): number | string => {
    const n = Number(v);
    return v === '' || v === null || !Number.isFinite(n) || n < 0 || n > max ? `${label} must be a number from 0 to ${max}.` : Math.round(n * 100) / 100;
  };
  for (const [k, label, max] of [['discountPct', 'The usual discount', 90], ['maxDiscountPct', 'The deepest discount', 95], ['minMarginPct', 'The minimum margin', 1000]] as Array<[keyof ModeSettings, string, number]>) {
    if (body?.[k] === undefined) continue;
    const r = pct(body[k], label, max);
    if (typeof r === 'string') return { error: r };
    (next as any)[k] = r;
  }
  if (next.discountPct > next.maxDiscountPct) return { error: 'The usual discount cannot be deeper than the deepest discount allowed.' };
  return { value: next };
}

export interface Preview {
  mode: PricingMode;
  price: number;           // before GST
  priceIncl: number;       // with GST: what the customer pays
  discountPct: number;
  markupPct: number;
  lowest: number;          // the lowest price allowed, before GST
  lowestIncl: number;
  ceilingIncl: number;     // the most the customer can be charged (the MRP)
  belowCost: boolean;      // at the MRP this product would lose money: the cost or pack size needs checking
  summary: string;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => n.toFixed(2);

/** A worked example, so an owner sees what a setting does to a real product. Null for SMART (the class decides, product by product). */
export function previewMode(ms: ModeSettings, ex: { mrp: number; cost: number; tax: number }): Preview | null {
  if (ms.mode === 'SMART' || !(ex.mrp > 0) || !(ex.cost >= 0)) return null;
  const tax = ex.tax >= 0 ? ex.tax : 0;
  const subject: Subject = { price: null, cost: ex.cost, mrp: ex.mrp, tax, abc: 'C', lastChange: null, today: '1970-01-01' };
  const policy = effectivePolicy(ms, { floorMarkupPct: 0, maxDiscountPct: 0 });
  const b = boundsOf(subject, policy);
  const incl = (p: number) => (Math.abs(p - b.ceiling) < 0.005 ? ex.mrp : r2(p * (1 + tax / 100)));
  const s = suggestPrice(subject, policy);
  if (!s) {
    return { mode: ms.mode, price: b.ceiling, priceIncl: ex.mrp, discountPct: 0, markupPct: r2(ex.cost > 0 ? (b.ceiling / ex.cost - 1) * 100 : 0), lowest: b.lower, lowestIncl: incl(b.lower), ceilingIncl: ex.mrp, belowCost: true,
      summary: 'At this cost the MRP would not cover the cost and the margin you require. The cost or the pack size needs checking before this product can be priced.' };
  }
  const base = { mode: ms.mode, price: s.price, priceIncl: incl(s.price), discountPct: s.discountPct, markupPct: s.markupPct, lowest: b.lower, lowestIncl: incl(b.lower), ceilingIncl: ex.mrp, belowCost: false };
  if (ms.mode === 'MRP') return { ...base, summary: `Sells at the MRP: ${money(ex.mrp)} with GST (${money(s.price)} before GST). The most it can be and the least it can be.` };
  return { ...base, summary: `Starts ${money(ms.discountPct)}% off the MRP: ${money(base.priceIncl)} with GST. No price may go below ${money(base.lowestIncl)} (${money(ms.maxDiscountPct)}% off${ms.minMarginPct > 0 ? `, or ${money(ms.minMarginPct)}% over cost` : ''}) or above the MRP, ${money(ex.mrp)}.` };
}

/** with GST: the price the customer pays, from a price before GST. A price at the ceiling is shown as the MRP itself. */
export function priceWithGst(ex: number, tax: number, mrp?: number | null): number {
  const ceiling = mrp && mrp > 0 ? Math.floor((mrp / (1 + tax / 100)) * 100 + 1e-6) / 100 : null;
  if (mrp && ceiling !== null && Math.abs(ex - ceiling) < 0.005) return mrp;
  return r2(ex * (1 + tax / 100));
}

/** before GST: the stored price, from what the customer pays. The MRP itself is the ceiling, never above it. */
export function priceBeforeGst(withGst: number, tax: number, mrp?: number | null): number {
  const ceiling = mrp && mrp > 0 ? Math.floor((mrp / (1 + tax / 100)) * 100 + 1e-6) / 100 : null;
  const ex = r2(withGst / (1 + tax / 100));
  if (ceiling !== null && (withGst >= (mrp as number) - 0.005 || ex > ceiling)) return ceiling;
  return ex;
}
