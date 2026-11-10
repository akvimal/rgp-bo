/** Rules for WhatsApp messages to customers. Pure functions, so they are tested without a database or Meta. */

export type MessageKind = 'BILL' | 'REFILL' | 'DUES' | 'DELIVERY' | 'REVIEW';
export type MessageLang = 'en' | 'ta';
export const LANGS: MessageLang[] = ['en', 'ta'];

/** an Indian mobile as WhatsApp wants it (country code, no plus): "98765 43210", "+91 98765-43210", "09876543210" all become 919876543210; anything else is null */
export function normaliseMobile(v: any): string | null {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? '91' + d : null;
}

/** the template's name at Meta: one per kind and language, e.g. bill_copy_en and bill_copy_ta */
const BASE: Record<MessageKind, string> = { BILL: 'bill_copy', REFILL: 'refill_due', DUES: 'dues_reminder', DELIVERY: 'delivery_update', REVIEW: 'review_invite' };
export const templateName = (kind: MessageKind, lang: MessageLang): string => `${BASE[kind]}_${lang}`;
export const asLang = (v: any): MessageLang => (LANGS.includes(v) ? v : 'en');

export interface Reachable { mobile: string | null; do_not_contact: boolean | null; contact_consent: string | null }

/**
 * Whether a customer may be sent a service message (a bill copy, a refill or dues reminder): they need a mobile, must not have switched contact off, and must
 * not have said NO. Promotional messages are a different test (consent YES), and are not sent in this release.
 */
export function canSendService(c: Reachable): { ok: boolean; reason?: string } {
  if (!normaliseMobile(c.mobile)) return { ok: false, reason: 'This customer has no valid mobile number.' };
  if (c.do_not_contact) return { ok: false, reason: 'This customer has asked not to be contacted.' };
  if (String(c.contact_consent ?? '').toUpperCase() === 'NO') return { ok: false, reason: 'This customer has said no to messages.' };
  return { ok: true };
}

const rupees = (n: number) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(/\.00$/, '');

/** the values that fill {{1}} to {{4}} in the bill_copy template: customer, shop, bill number, amount */
export function billParams(customerName: string | null, shop: string, billNo: string, total: number): string[] {
  const clean = (s: string, max: number) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max);
  return [clean(customerName || 'Customer', 40) || 'Customer', clean(shop, 40), clean(billNo, 20), rupees(total)];
}

/** the bill number as the customer knows it: the tax invoice number when there is one, else the bill number */
export const billLabel = (s: { gstinvoiceno?: string | null; billno?: number | null; id: number }): string => s.gstinvoiceno || (s.billno != null ? String(s.billno) : String(s.id));

/** a shop's messages this month against its cap; a cap of 0 stops sending */
export const overMonthlyCap = (sentThisMonth: number, cap: number): boolean => sentThisMonth >= cap;

/** how Meta's error codes should be treated: permanent (do not try again) or worth another try later */
export function classifyMetaError(status: number, code: number | undefined): { permanent: boolean; blocked?: boolean; auth?: boolean } {
  if (status === 401 || code === 190) return { permanent: true, auth: true };
  if (status === 429 || code === 4 || code === 80007 || code === 130429) return { permanent: false };
  if (code === 131026 || code === 131047 || code === 131051) return { permanent: true, blocked: true };   // not on WhatsApp, 24h window, unsupported
  if (code === 132000 || code === 132001 || code === 132005 || code === 132012 || code === 132015) return { permanent: true };        // template problems
  if (code === 131056) return { permanent: false };                                                      // pair rate limit
  return { permanent: status >= 400 && status < 500 };
}

/** minutes to wait before attempt n+1; null after the last */
const RETRY = [1, 5, 30, 120];
export const retryInMinutes = (attempts: number): number | null => (attempts >= 1 && attempts <= RETRY.length ? RETRY[attempts - 1] : null);

/** words that mean "stop messaging me", in English and Tamil, as a customer would reply */
export function isStopWord(text: string): boolean {
  const t = String(text ?? '').trim().toLowerCase();
  return ['stop', 'unsubscribe', 'cancel', 'நிறுத்து', 'நிறுத்துங்கள்', 'வேண்டாம்'].includes(t);
}
