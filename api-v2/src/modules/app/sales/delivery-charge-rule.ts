/**
 * How the customer paid the delivery charge. The charge is outside the bill total, so when it is paid by UPI or card it has to be counted in the digital
 * takings of the shift of the sale, or the close shows a variance against the terminal. Pure so it can be tested without a database.
 */
export const CHARGE_VIA = ['CASH', 'DIGITAL', 'NONE'] as const;
export const CHARGE_METHODS = ['UPI', 'Card', 'Wallet', 'Other'] as const;

export interface ChargePayment { chargevia: string | null; chargemethod: string | null; chargeref: string | null }

/** the cleaned fields, or a message for the person; null when the request does not mention the charge payment at all (nothing is changed) */
export function cleanChargePayment(d: any): { ok: true; value: ChargePayment | null } | { ok: false; message: string } {
  if (!d || d.chargevia === undefined) return { ok: true, value: null };
  const charge = Math.max(0, Number(d.charges) || 0);
  const none: ChargePayment = { chargevia: null, chargemethod: null, chargeref: null };
  const via = String(d.chargevia || '').trim().toUpperCase();
  if (!via) return { ok: true, value: none };
  if (!(CHARGE_VIA as readonly string[]).includes(via)) return { ok: false, message: 'Say whether the delivery charge was paid in cash, digitally, or not collected.' };
  if (charge <= 0) return { ok: true, value: none };
  if (via !== 'DIGITAL') return { ok: true, value: { chargevia: via, chargemethod: null, chargeref: null } };
  const method = (CHARGE_METHODS as readonly string[]).find(m => m.toLowerCase() === String(d.chargemethod || '').trim().toLowerCase());
  if (!method) return { ok: false, message: `Choose how the delivery charge was paid: ${CHARGE_METHODS.join(', ')}.` };
  const ref = String(d.chargeref || '').toUpperCase().replace(/\s+/g, '');
  if (ref && !/^[A-Z0-9][A-Z0-9\-_/]{3,39}$/.test(ref)) return { ok: false, message: 'Enter the last 4 digits of the transaction id for the delivery charge, or leave it blank.' };
  return { ok: true, value: { chargevia: 'DIGITAL', chargemethod: method, chargeref: ref || null } };
}

/** a digital charge already counted in a closed shift's takings cannot change quietly */
export function digitalChargeChanged(before: { charges?: any; chargevia?: any; chargemethod?: any } | null, after: { charges: number; chargevia?: any; chargemethod?: any }): boolean {
  const was = before && before.chargevia === 'DIGITAL' ? Number(before.charges) || 0 : 0;
  const will = after.chargevia === 'DIGITAL' ? Number(after.charges) || 0 : 0;
  if (was === 0 && will === 0) return false;
  return was !== will || (before?.chargemethod ?? null) !== (after.chargemethod ?? null);
}
