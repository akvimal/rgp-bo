import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** How a bill can be paid digitally. The provider is one for now (Paytm); the method is how the customer paid. */
export const DIGITAL_METHODS = ['UPI', 'Card', 'Wallet', 'Other'] as const;
export const DIGITAL_PROVIDER = process.env.DIGITAL_PROVIDER || 'Paytm';

// older clients and old data name the app rather than the method; these map to a method
const LEGACY: Record<string, string> = { paytm: 'UPI', gpay: 'UPI', phonepe: 'UPI', bhim: 'UPI', upi: 'UPI', card: 'Card', wallet: 'Wallet', other: 'Other' };

/**
 * A completed bill with a digital amount must say how it was paid and carry the provider's reference, so the bill can
 * be matched to the settlement file later. A bill with no digital amount carries neither. Returns the cleaned fields.
 */
export async function checkDigitalPayment(manager: EntityManager, sale: any, saleId?: number | null) {
  const none = { digimethod: null, digirefno: null, digiprovider: null };
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return null;      // drafts and pending bills are not checked yet
  if (!(Number(sale?.digiamt || 0) > 0)) return none;

  const method = LEGACY[String(sale?.digimethod || '').trim().toLowerCase()];
  if (!method) throw new BadRequestException(`Choose how the digital amount was paid: ${DIGITAL_METHODS.join(', ')}.`);

  const ref = String(sale?.digirefno || '').toUpperCase().replace(/\s+/g, '');
  if (!ref) throw new BadRequestException(`Enter the ${DIGITAL_PROVIDER} reference (transaction or UTR number) for the digital payment.`);
  if (!/^[A-Z0-9][A-Z0-9\-_/]{5,39}$/.test(ref)) {
    throw new BadRequestException(`The ${DIGITAL_PROVIDER} reference must be 6 to 40 letters and digits, with no spaces.`);
  }

  const [dup] = await manager.query(
    `select id, bill_no from sale where digi_provider = $1 and upper(digi_refno) = $2 and status = 'COMPLETE' and id <> $3 limit 1`,
    [DIGITAL_PROVIDER, ref, saleId || 0]);
  if (dup) throw new BadRequestException(`That ${DIGITAL_PROVIDER} reference is already on bill ${dup.bill_no ?? dup.id}. One payment cannot pay two bills.`);

  return { digimethod: method, digirefno: ref, digiprovider: DIGITAL_PROVIDER };
}
