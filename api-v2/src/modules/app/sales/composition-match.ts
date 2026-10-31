/**
 * Compares the composition (salt) text of two medicines. The text is typed by hand ("Acarbose (25mg)", "ACARBOSE 25MG",
 * "Atorvastatin 10 MG + Clopidogrel 75 MG"), so it is cleaned before it is compared: case, spaces and brackets do not matter, and
 * the ingredients of a combination may come in any order. The strength stays part of the match, so 500 mg never matches 650 mg.
 * The stored text is never changed.
 */

export interface CompositionKey {
  /** same medicine and strength: ingredients with their strengths, cleaned and sorted */
  key: string;
  /** same ingredients whatever the strength, to show "other strengths" apart from real alternatives */
  salts: string;
  /** every ingredient has a number in it; without one the strength is unknown and the match is not safe */
  hasStrength: boolean;
}

function clean(part: string): string {
  return part.toLowerCase().replace(/[^a-z0-9.%/]/g, '');
}

/** null when there is no composition to compare */
export function compositionKey(text: unknown): CompositionKey | null {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(/\+|&/).map(clean).filter(Boolean);
  if (!parts.length) return null;
  parts.sort();
  // the ingredient is the text before its strength starts
  const salts = parts.map((p) => p.split(/[0-9]/)[0]).sort();
  return {
    key: parts.join('+'),
    salts: salts.join('+'),
    hasStrength: parts.every((p) => /[0-9]/.test(p)),
  };
}

/** a pack that needs a prescription: schedule H, H1 or X */
export function needsPrescription(schedule: unknown): boolean {
  return ['H', 'H1', 'X'].includes(String(schedule ?? ''));
}
