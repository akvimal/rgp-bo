/**
 * Fixed Indian cash denominations used for the shift drawer count.
 * Face values only — a ₹20 note and a ₹20 coin are counted as the same row.
 * See docs/planning/CASHIER_SHIFT_CLOSE.md (decision 5: fixed set).
 */
export const CASH_DENOMINATIONS: number[] = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

type DenomRow = { d: number; n: number };

function readRow(row: any): DenomRow | null {
  const d = Number(row?.d ?? row?.denomination ?? 0);
  const n = Math.max(0, Math.floor(Number(row?.n ?? row?.count ?? 0)));
  if (!CASH_DENOMINATIONS.includes(d)) {
    return null;
  }
  return { d, n };
}

/** Collapse arbitrary client input to a clean, ordered array (or null if nothing usable). */
export function normalizeDenominations(rows: any): DenomRow[] | null {
  if (!Array.isArray(rows)) {
    return null;
  }
  const totals = new Map<number, number>();
  for (const row of rows) {
    const parsed = readRow(row);
    if (parsed) {
      totals.set(parsed.d, (totals.get(parsed.d) || 0) + parsed.n);
    }
  }
  const cleaned = CASH_DENOMINATIONS
    .filter((d) => (totals.get(d) || 0) > 0)
    .map((d) => ({ d, n: totals.get(d) as number }));
  return cleaned.length ? cleaned : null;
}

/** Sum of denomination × count. Returns 0 for anything unusable. */
export function denominationTotal(rows: any): number {
  const cleaned = normalizeDenominations(rows);
  if (!cleaned) {
    return 0;
  }
  return cleaned.reduce((sum, row) => sum + row.d * row.n, 0);
}
