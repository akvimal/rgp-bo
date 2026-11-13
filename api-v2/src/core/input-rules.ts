/**
 * Standard patterns for typed input, shared by every screen's API. Pure: no framework, no database.
 * The Angular forms carry the same patterns (frontend/src/app/shared/input-rules.ts) so the screen and the API agree.
 */

/**
 * A person's name: starts with a letter (any script, so Tamil and its vowel signs work), then letters, marks, spaces and . ' - only,
 * with at least two letters in all. Allows D'Souza, Mary-Ann, A. K. Raj; refuses digits and symbols such as @ # $ %.
 */
export const PERSON_NAME = /^(?=(?:.*\p{L}){2})[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

/** A business or place name: letters and digits, with & . , ' - ( ) / and spaces; it must start with a letter or digit. */
export const BUSINESS_NAME = /^(?=.*\p{L})[\p{L}\p{N}][\p{L}\p{M}\p{N} &.,'’()/-]*$/u;

export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE = /^[1-9][0-9]{5}$/;

export const PERSON_NAME_MESSAGE = 'Enter a real name: letters, spaces and . \' - only (at least 2 letters, no digits or symbols).';

/** a person's name collapsed to single spaces, or the reason it is refused. Blank is not refused here: the caller decides if it is required. */
export function personNameProblem(value: unknown, max = 80, label = 'The name'): { error: string } | { value: string | null } {
  if (value === undefined || value === null) return { value: null };
  const t = String(value).trim().replace(/\s+/g, ' ');
  if (!t) return { value: null };
  if (t.length > max) return { error: `${label} can be at most ${max} characters.` };
  if (!PERSON_NAME.test(t)) return { error: PERSON_NAME_MESSAGE };
  return { value: t };
}
