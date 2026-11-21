import { brandKey } from './drug-ref-rules';
import { classifyForm, formRelation } from './dosage-form';

/**
 * Pure rules for filling the composition of products that have none, from the brand dictionary: a product's title ("Telma 40 Tablet", "EZENTIB 10MG TAB 10'S",
 * "Augmentin Duo [CIP12]") is looked up among the dictionary's brand names. Only a sure match is made: the dictionary brands the title stands for must all
 * give the same composition (and the same form, when the title does not say which), otherwise the product is left for a person. Nothing is guessed.
 */

export interface FillBrand { brand_key: string; brand: string; manufacturer: string | null; composition: string; composition_key: string; dosage_form: string | null }
export interface FillMatch { composition: string; form: string | null; brand: string; manufacturer: string | null; exact: boolean }
export interface FillIndex { find(title: string): FillMatch | null }

/** what may follow the title in a dictionary brand name ("Telma 40" -> "Telma 40 mg oral tablet"); a digit or another letter means a different brand ("Telma 400", "Telma 40H") */
const BOUNDARY = /^(mg|mcg|ug|gm|g|ml|iu|oral|film|tablets?|capsules?|syrup|suspension|solution|injection|cream|ointment|gel|drops?|eye|ear|nasal|powder|sustained|prolonged|extended|chewable|dispersible|lozenge|topical|sublingual|enteric|soft|hard|delayed|modified|conventional|rectal|vaginal|inhal)/;
const FORM_WORDS = /\b(tablets?|tabs?|capsules?|caps?|syrup|syp|suspension|susp|drops?|injection|inj|gel|cream|ointment|oint|lotion|sachet|powder|solution|sol)\b/gi;

/** the title without the supplier code in brackets and the pack ("10's", "x 10", "strip of 10") */
export function cleanTitle(title: string): string {
  return String(title ?? '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\b\d+\s*'?\s*s\b/gi, ' ')
    .replace(/\b(?:x|strip of|pack of)\s*\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** the brand keys a title may stand for, the fuller one first: with the form words, and without them */
export function titleKeys(title: string): string[] {
  const clean = cleanTitle(title);
  const keys = [brandKey(clean), brandKey(clean.replace(FORM_WORDS, ' '))].filter((k) => k.length >= 4);
  return Array.from(new Set(keys));
}

/** the official list uses international names; the counter knows the Indian ones (matching treats them as the same ingredient already) */
export function indianNames(composition: string): string {
  return composition.replace(/acetaminophen/gi, (m) => (m[0] === m[0].toUpperCase() ? 'Paracetamol' : 'paracetamol')).replace(/albuterol/gi, (m) => (m[0] === m[0].toUpperCase() ? 'Salbutamol' : 'salbutamol'));
}

export function makeFillIndex(brands: FillBrand[]): FillIndex {
  const sorted = brands.slice().sort((a, b) => (a.brand_key < b.brand_key ? -1 : a.brand_key > b.brand_key ? 1 : 0));
  const lowerBound = (key: string) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m].brand_key < key) lo = m + 1; else hi = m; } return lo; };
  return {
    find(title: string): FillMatch | null {
      const productForm = classifyForm(title);
      for (const key of titleKeys(title)) {
        const cands: FillBrand[] = [];
        for (let i = lowerBound(key); i < sorted.length && sorted[i].brand_key.startsWith(key); i++) {
          const rest = sorted[i].brand_key.slice(key.length);
          if (rest === '' || BOUNDARY.test(rest)) cands.push(sorted[i]);
        }
        const fit = productForm ? cands.filter((c) => formRelation(productForm, c.dosage_form) !== 'different') : cands;
        if (!fit.length) continue;
        const first = fit[0];
        const agree = fit.every((c) => c.composition_key === first.composition_key && (productForm || c.dosage_form === first.dosage_form));
        if (!agree) return null;                                                       // the brand has more than one composition or form: not sure
        const exact = fit.find((c) => c.brand_key === key) ?? first;
        return { composition: indianNames(first.composition), form: productForm ?? first.dosage_form, brand: exact.brand, manufacturer: exact.manufacturer || null, exact: exact.brand_key === key };
      }
      return null;
    },
  };
}
