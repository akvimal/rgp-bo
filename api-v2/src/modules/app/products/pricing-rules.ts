/**
 * The pricing rules the Business Head can change, held as app_setting rows. Each has limits so a typing mistake cannot switch a
 * safeguard off by accident. `editable: false` rules are shown but fixed: the till uses its own copy of the GST cap, so changing the
 * number here alone would make the till and the server disagree.
 */
export interface RuleDef {
  key: string;
  category: 'pricing' | 'purchases';
  group: 'steps' | 'approval' | 'purchase' | 'billing';
  label: string;
  help: string;
  type: 'number' | 'switch';
  unit?: string;
  min?: number;
  max?: number;
  default: string;
  editable: boolean;
}

export const RULES: RuleDef[] = [
  { key: 'price_step_pct', category: 'pricing', group: 'steps', label: 'Largest raise in one step', help: 'A price is raised by at most this percent of its current price per step, so customers never see a sudden jump. The smaller of this and the MRP limit below applies.', type: 'number', unit: '% of the price', min: 1, max: 50, default: '10', editable: true },
  { key: 'price_step_mrp_pct', category: 'pricing', group: 'steps', label: 'Largest raise in one step, against the MRP', help: 'A raise is also at most this percent of the MRP (without GST). This stops a cheap-looking item jumping by a large share of its MRP.', type: 'number', unit: '% of the MRP', min: 1, max: 50, default: '5', editable: true },
  { key: 'price_step_days', category: 'pricing', group: 'steps', label: 'Days between raises', help: 'A product is raised at most once in this many days. A price cut is never held.', type: 'number', unit: 'days', min: 1, max: 90, default: '14', editable: true },
  { key: 'price_store_head_limit_pct', category: 'pricing', group: 'approval', label: 'A Store Head may approve a change up to', help: 'A price change that breaks the rules can be approved by a Store Head up to this percent, on class B and C products. Anything bigger, and every class A product, needs the Business Head.', type: 'number', unit: '% change', min: 1, max: 100, default: '15', editable: true },
  { key: 'price_tolerance_pct', category: 'purchases', group: 'purchase', label: 'Vendor rate rise that needs no reason', help: 'When an invoice line costs more than the last rate from that vendor, a rise up to this percent passes without a reason.', type: 'number', unit: '%', min: 0, max: 10, default: '0.5', editable: true },
  { key: 'price_approval_pct', category: 'purchases', group: 'purchase', label: 'Vendor rate rise that needs a Store Head or Business Head', help: 'A rise above this percent can only be completed by a Store Head or Business Head, with a reason.', type: 'number', unit: '%', min: 1, max: 50, default: '5', editable: true },
  { key: 'sale_mrp_guard', category: 'pricing', group: 'billing', label: 'Refuse a bill that charges above the MRP', help: 'On: a completed bill with any line whose price plus GST is above the MRP is refused. Off: such a bill is allowed (use it only while correcting the price list).', type: 'switch', default: 'on', editable: true },
  { key: 'sale_gst_cap_pct', category: 'pricing', group: 'billing', label: 'GST the till bills at most', help: 'Since GST 2.0 the till bills at most 5% on every line. The price ceiling and discounts are worked out with this. It is fixed here because the till has its own copy; changing it needs a software change.', type: 'number', unit: '%', default: '5', editable: false },
];

export function ruleOf(key: string): RuleDef | undefined {
  return RULES.find((r) => r.key === key);
}

/** The value as it will be stored, or an error message. */
export function cleanRuleValue(def: RuleDef, raw: any): { value?: string; error?: string } {
  if (!def.editable) return { error: `${def.label} cannot be changed here.` };
  if (def.type === 'switch') {
    const v = String(raw ?? '').toLowerCase();
    return v === 'on' || v === 'off' ? { value: v } : { error: `${def.label}: choose on or off.` };
  }
  if (raw === '' || raw === null || raw === undefined) return { error: `${def.label}: enter a number.` };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < (def.min ?? 0) || n > (def.max ?? 100)) {
    return { error: `${def.label}: enter a number from ${def.min} to ${def.max}.` };
  }
  return { value: String(Math.round(n * 100) / 100) };
}
