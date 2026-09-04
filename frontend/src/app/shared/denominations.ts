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
