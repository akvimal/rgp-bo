/** What a brand check at the counter found, kept so the weekly review can count the ones that had no match. Pure, so tested without a database. */

export const LOOKUP_KINDS = ['BRAND', 'PRODUCT', 'TYPED'] as const;
export const LOOKUP_OUTCOMES = ['IN_STOCK', 'OTHER_FORM', 'NOT_STOCKED', 'NO_COMP', 'NOT_FOUND'] as const;
export type LookupOutcome = (typeof LOOKUP_OUTCOMES)[number];

/** the outcomes that count as "no match in stock": nothing in the same form, whether or not another form was there */
export const NO_MATCH: readonly string[] = ['OTHER_FORM', 'NOT_STOCKED', 'NOT_FOUND'];

/**
 * From the answer of the brand or product lookup: in stock (the same composition, strength and form, or the product asked for itself), only in another
 * form, or nothing in stock. A medicine with no composition (or no strength) to match on cannot say.
 */
export const outcomeOf = (r: { status?: string; same?: any[]; otherForms?: any[]; askedInStock?: boolean }): LookupOutcome => {
  if (r.status === 'NO_COMPOSITION' || r.status === 'NO_STRENGTH') return 'NO_COMP';
  if (r.askedInStock || (r.same?.length ?? 0) > 0) return 'IN_STOCK';
  if ((r.otherForms?.length ?? 0) > 0) return 'OTHER_FORM';
  return 'NOT_STOCKED';
};

/** the text kept for a typed brand: trimmed, one space between words, cut to the column; null when too short to mean anything */
export const cleanTyped = (t: any): string | null => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return s.length >= 3 ? s : null;
};
