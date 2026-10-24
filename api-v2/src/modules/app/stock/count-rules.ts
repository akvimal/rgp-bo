/** What a stock count does with the products it finds out by a lot. Pure, so it is tested without a database. */

export const DEFAULT_ESCALATION_VALUE = 500;

export interface CountLine { itemid: number; productid: number; diff: number; unitcost: number; }

/** the products whose total difference across their batches, valued at cost, is above the limit */
export const escalatedProducts = (lines: CountLine[], limit: number = DEFAULT_ESCALATION_VALUE): Set<number> => {
  const value = new Map<number, number>();
  for (const l of lines) {
    value.set(l.productid, (value.get(l.productid) ?? 0) + Math.abs(l.diff) * (l.unitcost || 0));
  }
  return new Set([...value].filter(([, v]) => Math.round(v * 100) / 100 > limit).map(([p]) => p));
};

/** only the people who run the whole business settle a large count difference */
export const maySettleEscalated = (roleName: string | null | undefined): boolean => roleName === 'Business Head' || roleName === 'Owner-operator';
