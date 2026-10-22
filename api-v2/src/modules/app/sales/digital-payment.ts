import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** How a bill can be paid digitally. The provider is one for now (Paytm); the method is how the customer paid. */
export const DIGITAL_METHODS = ['UPI', 'Card', 'Wallet', 'Other'] as const;
export const DIGITAL_PROVIDER = process.env.DIGITAL_PROVIDER || 'Paytm';

// older clients and old data name the app rather than the method; these map to a method
const LEGACY: Record<string, string> = { paytm: 'UPI', gpay: 'UPI', phonepe: 'UPI', bhim: 'UPI', upi: 'UPI', card: 'Card', wallet: 'Wallet', other: 'Other' };

/**
 * A completed bill with a digital amount must say how it was paid. The reference is the last digits of the provider's
 * transaction id (4 is enough; a longer one may be pasted) and is optional: with the amount and the time it lets the bill
 * be matched to the statement later. A bill with no digital amount carries neither. Returns the cleaned fields.
 */
export async function checkDigitalPayment(manager: EntityManager, sale: any, saleId?: number | null) {
  const none = { digimethod: null, digirefno: null, digiprovider: null };
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return null;      // drafts and pending bills are not checked yet
  if (!(Number(sale?.digiamt || 0) > 0)) return none;

  const method = LEGACY[String(sale?.digimethod || '').trim().toLowerCase()];
  if (!method) throw new BadRequestException(`Choose how the digital amount was paid: ${DIGITAL_METHODS.join(', ')}.`);

  const ref = String(sale?.digirefno || '').toUpperCase().replace(/\s+/g, '');
  if (ref && !/^[A-Z0-9][A-Z0-9\-_/]{3,39}$/.test(ref)) {
    throw new BadRequestException(`Enter the last 4 digits of the ${DIGITAL_PROVIDER} transaction id, or leave it blank.`);
  }
  return { digimethod: method, digirefno: ref || null, digiprovider: DIGITAL_PROVIDER };
}
