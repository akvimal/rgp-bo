/**
 * Fixed Indian cash denominations for the shift drawer count (face values only).
 * Mirrors api-v2/src/modules/app/store/denominations.ts. See
 * docs/planning/CASHIER_SHIFT_CLOSE.md (decision 5: fixed set).
 */
export const CASH_DENOMINATIONS: number[] = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export interface DenominationRow {
  d: number;
  n: number;
}

/**
 * What to take out of a counted drawer for the vault so the drawer keeps its float. With a float mix set, the drawer keeps up to that many
 * of each face value; otherwise it keeps the smallest notes and coins until the float amount is reached.
 */
export function suggestVaultDrop(counted: DenominationRow[], floatAmount: number, floatRows: DenominationRow[] | null | undefined): DenominationRow[] {
  const have = new Map<number, number>();
  (counted || []).forEach(r => have.set(Number(r.d), (have.get(Number(r.d)) || 0) + Number(r.n || 0)));
  const keep = new Map<number, number>();
  if (floatRows && floatRows.length) {
    floatRows.forEach(r => keep.set(Number(r.d), Math.min(have.get(Number(r.d)) || 0, Number(r.n || 0))));
  } else {
    let kept = 0;
    for (const d of [...CASH_DENOMINATIONS].reverse()) {
      let n = 0;
      while (n < (have.get(d) || 0) && kept + d <= Number(floatAmount || 0)) { n++; kept += d; }
      if (n) keep.set(d, n);
    }
  }
  return CASH_DENOMINATIONS
    .map(d => ({ d, n: (have.get(d) || 0) - (keep.get(d) || 0) }))
    .filter(r => r.n > 0);
}

export function denominationTotal(rows: DenominationRow[] | null | undefined): number {
  if (!Array.isArray(rows)) {
    return 0;
  }
  return rows.reduce((sum, row) => {
    const d = Number(row?.d || 0);
    const n = Number(row?.n || 0);
    return sum + (CASH_DENOMINATIONS.includes(d) && n > 0 ? d * n : 0);
  }, 0);
}
