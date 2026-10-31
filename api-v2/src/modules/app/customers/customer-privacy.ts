/**
 * Hiding customer contact details from people who do not need to read them. A masked value carries the MASK character, which never occurs in
 * real data, so a masked value that comes back from a screen (an edit form, a bill) is recognised and never saved over the real one.
 */
export const MASK = '•';

/** 98•••••210: the first two and last three digits. Anything that is not 10 digits is hidden entirely. */
export function maskMobile(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value);
  return /^[0-9]{10}$/.test(v) ? `${v.slice(0, 2)}${MASK.repeat(5)}${v.slice(7)}` : MASK.repeat(6);
}

/** j•••@gmail.com: the first letter and the domain. */
export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = String(value).indexOf('@');
  return at < 1 ? MASK.repeat(6) : `${String(value)[0]}${MASK.repeat(3)}${String(value).slice(at)}`;
}

/** an address is hidden whole; the locality stays visible */
export function maskAddress(value: string | null | undefined): string | null {
  return value ? MASK.repeat(6) : null;
}

export const isMasked = (value: unknown): boolean => typeof value === 'string' && value.includes(MASK);

/** The fields a masked caller gets in place of the real ones. */
export function maskContact<T extends { mobile?: any; altmobile?: any; email?: any; address?: any }>(c: T): T & { masked: true } {
  return { ...c, mobile: maskMobile(c.mobile), altmobile: maskMobile(c.altmobile), email: maskEmail(c.email), address: maskAddress(c.address), masked: true };
}
