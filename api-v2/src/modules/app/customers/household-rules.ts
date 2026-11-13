import { money } from '../sales/customer-due-rule';

/** Why a balance cannot be moved from one household to another, or null. `available` is what the source household has (owed, or store credit). */
export function transferProblem(kind: string, amount: number, available: number, sameHousehold: boolean, reason: string): string | null {
  if (sameHousehold) return 'Both people are on the same number: there is nothing to move.';
  if (kind !== 'DUE' && kind !== 'CREDIT') return 'Say whether it is dues or store credit.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter the amount to move.';
  if (String(reason || '').trim().length < 5) return 'Say why: at least 5 characters.';
  if (money(amount) > money(available) + 0.005) {
    return kind === 'DUE' ? `Only ${money(available).toFixed(2)} is owed; you cannot move more than that.` : `Only ${money(available).toFixed(2)} of store credit is held; you cannot move more than that.`;
  }
  return null;
}
