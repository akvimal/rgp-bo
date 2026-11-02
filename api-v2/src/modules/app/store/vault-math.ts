import { CASH_DENOMINATIONS, denominationTotal, normalizeDenominations } from './denominations';

export type Denoms = Array<{ d: number; n: number }>;
export type VaultMovementRow = { direction: 'IN' | 'OUT'; amount: number; denominations: Denoms | null; status: string };

/** Notes and coins on hand by face value, from the confirmed movements only (pending and rejected never count). */
export function vaultHoldings(rows: VaultMovementRow[]): Map<number, number> {
  const held = new Map<number, number>();
  for (const row of rows) {
    if (row.status !== 'CONFIRMED') continue;
    const sign = row.direction === 'IN' ? 1 : -1;
    for (const part of normalizeDenominations(row.denominations) || []) {
      held.set(part.d, (held.get(part.d) || 0) + sign * part.n);
    }
  }
  return held;
}

export function holdingsToDenoms(held: Map<number, number>): Denoms {
  return CASH_DENOMINATIONS.filter((d) => (held.get(d) || 0) !== 0).map((d) => ({ d, n: held.get(d) as number }));
}

export function holdingsTotal(held: Map<number, number>): number {
  let sum = 0;
  held.forEach((n, d) => { sum += d * n; });
  return sum;
}

/** Pending outgoing movements are set aside so two waiting deposits cannot both claim the same notes. */
export function reservedByPending(rows: VaultMovementRow[]): Map<number, number> {
  const reserved = new Map<number, number>();
  for (const row of rows) {
    if (row.status !== 'PENDING' || row.direction !== 'OUT') continue;
    for (const part of normalizeDenominations(row.denominations) || []) {
      reserved.set(part.d, (reserved.get(part.d) || 0) + part.n);
    }
  }
  return reserved;
}

/** The first face value the request asks for more of than is available, or null when the vault can cover it. */
export function firstShortfall(request: Denoms, held: Map<number, number>, reserved: Map<number, number> = new Map()): { d: number; wanted: number; available: number } | null {
  for (const part of request) {
    const available = (held.get(part.d) || 0) - (reserved.get(part.d) || 0);
    if (part.n > available) return { d: part.d, wanted: part.n, available: Math.max(0, available) };
  }
  return null;
}

/** A request as clean denominations and the amount they add up to; null when nothing usable was sent. */
export function readRequest(raw: any): { denominations: Denoms; amount: number } | null {
  const denominations = normalizeDenominations(raw);
  if (!denominations) return null;
  return { denominations, amount: denominationTotal(denominations) };
}
