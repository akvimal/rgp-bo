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

/** words that only say which salt of the ingredient it is, or which pharmacopoeia: "Metformin hydrochloride", "Pantoprazole sodium", "Bisacodyl IP" are the ingredient itself */
const SALT_WORDS = new Set(['hydrochloride', 'hcl', 'hydrobromide', 'besilate', 'besylate', 'mesylate', 'maleate', 'sodium', 'potassium', 'calcium', 'sulphate', 'sulfate',
  'bisulfate', 'dihydrate', 'monohydrate', 'trihydrate', 'anhydrous', 'ip', 'bp', 'usp']);
/** the same ingredient under another name (the official list uses the international names, the counter uses the Indian ones) */
const SYNONYMS: Record<string, string> = {
  acetaminophen: 'paracetamol', amoxycillin: 'amoxicillin', lignocaine: 'lidocaine', adrenaline: 'epinephrine', frusemide: 'furosemide', albuterol: 'salbutamol',
  thyroxine: 'levothyroxine', thyroxinesodium: 'levothyroxine', cetrizine: 'cetirizine',
};

function clean(part: string): string {
  return part.toLowerCase().replace(/[^a-z0-9.%/]/g, '');
}

/**
 * One ingredient with its strength, cleaned: "(as clavulanate potassium)" and salt words after the name are dropped ("Metformin hydrochloride 500 mg" and
 * "Metformin (500mg)" are the same), the name is mapped to the one used here, and "microgram" is "mcg". Strength stays part of it.
 */
function normalisePart(raw: string): { name: string; text: string } {
  const t = raw.replace(/\(\s*as\b[^)]*\)/gi, ' ').replace(/\bmicrograms?\b/gi, 'mcg').replace(/\bmilligrams?\b/gi, 'mg');
  const at = t.search(/[0-9]/);
  const namePart = at < 0 ? t : t.slice(0, at);
  const rest = at < 0 ? '' : t.slice(at);
  const words = (namePart.toLowerCase().match(/[a-z]+/g) || []).slice();
  while (words.length > 1 && SALT_WORDS.has(words[words.length - 1])) words.pop();
  const joined = words.join('');
  const name = SYNONYMS[joined] ?? joined;
  return { name, text: name + clean(rest) };
}

/** null when there is no composition to compare */
export function compositionKey(text: unknown): CompositionKey | null {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(/\+|&|\sand\s/i).map(normalisePart).filter((p) => p.text);
  if (!parts.length) return null;
  parts.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  return {
    key: parts.map((p) => p.text).join('+'),
    // the ingredient is the text before its strength starts
    salts: parts.map((p) => p.name).sort().join('+'),
    hasStrength: parts.every((p) => /[0-9]/.test(p.text)),
  };
}

/** a pack that needs a prescription: schedule H, H1 or X */
export function needsPrescription(schedule: unknown): boolean {
  return ['H', 'H1', 'X'].includes(String(schedule ?? ''));
}
