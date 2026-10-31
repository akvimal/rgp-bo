/** the most phone numbers one place can list, and the most characters they take together */
export const MAX_PHONES = 4;
export const PHONES_MAX_LENGTH = 60;

/**
 * One or more phone numbers typed in one box, separated by commas, slashes or semicolons. Returns them tidied ("a, b"), or the reason
 * they cannot be kept. Empty is fine: nothing is shown.
 */
export function checkPhones(raw: any, label = 'The phone'): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: true, value: null };
  const parts = text.split(/[,;/|]+/).map((p) => p.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (parts.length > MAX_PHONES) return { ok: false, error: `${label} can list at most ${MAX_PHONES} numbers.` };
  if (parts.some((p) => !/^[0-9+() -]{6,20}$/.test(p))) return { ok: false, error: `${label} number is not valid: use digits, spaces, + ( ) and -, and separate several numbers with a comma.` };
  const value = parts.join(', ');
  if (value.length > PHONES_MAX_LENGTH) return { ok: false, error: `${label} numbers can be at most ${PHONES_MAX_LENGTH} characters together.` };
  return { ok: true, value };
}
