/**
 * Dosage form as a small controlled list, so "same medicine" can mean the same form too: a sustained-release tablet is not a plain tablet, a syrup is not a
 * tablet. `classifyForm` reads it from a drug-form text (the brand dictionary's "Tablet Sr", a CDCI drug form such as "Prolonged-release tablet") or from a
 * product title as the shop writes it ("BICIPHAGE 500MG SR TAB 10'S"). It returns null when nothing in the text says: an unknown form is never guessed.
 */
export const DOSAGE_FORMS = [
  { key: 'tablet', label: 'Tablet' },
  { key: 'tablet_sr', label: 'Tablet, sustained release' },
  { key: 'tablet_dt', label: 'Tablet, dispersible or chewable' },
  { key: 'capsule', label: 'Capsule' },
  { key: 'capsule_sr', label: 'Capsule, sustained release' },
  { key: 'syrup', label: 'Syrup or suspension' },
  { key: 'drops', label: 'Drops' },
  { key: 'injection', label: 'Injection' },
  { key: 'topical', label: 'Cream, ointment or gel' },
  { key: 'powder', label: 'Powder or sachet' },
  { key: 'inhaler', label: 'Inhaler or spray' },
  { key: 'other', label: 'Other' },
] as const;

export type DosageForm = (typeof DOSAGE_FORMS)[number]['key'];
export const DOSAGE_FORM_KEYS: string[] = DOSAGE_FORMS.map((f) => f.key);
export const isDosageForm = (v: unknown): v is DosageForm => typeof v === 'string' && DOSAGE_FORM_KEYS.includes(v);
export const dosageFormLabel = (key: string | null | undefined): string => DOSAGE_FORMS.find((f) => f.key === key)?.label ?? '';

const word = (re: string) => new RegExp(`(^|[^a-z0-9])(?:${re})(?![a-z0-9])`);
const INJECTION = word('inj|injection|injectable|infusion|vial|ampoule|ampule');
const INHALER = word('inhaler|inhalation|rotacaps?|respules?|nebuli[sz]er|spray|mdi');
const DROPS = word('drops?|gtt');
const TOPICAL = word('creams?|ointments?|oint|gels?|lotion|paste|liniment|balm');
const SYRUP = word('syrup|syp|suspension|susp|sus|solution|sol|liquid|elixir|emulsion|linctus');
const CAPSULE = word('capsules?|caps?|softules?|softgels?|rotacap');
const TABLET = word('tablets?|tabs?|lozenges?|caplets?');
const POWDER = word('powder|pwd|sachets?|granules?');
const SUSTAINED = word('sr|er|xr|cr|pr|mr|sustained|extended|prolonged|modified|controlled|retard');
const DISPERSIBLE = word('dt|dispersible|chewable|chew|md|mouth dissolving|orally disintegrating|odt|melt');

/** the form a text names, or null when it names none */
export function classifyForm(text: unknown): DosageForm | null {
  const t = String(text ?? '').toLowerCase().replace(/[-_/,()]+/g, ' ').replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (INJECTION.test(t)) return 'injection';
  if (INHALER.test(t)) return 'inhaler';
  if (DROPS.test(t)) return 'drops';
  if (TOPICAL.test(t)) return 'topical';
  if (SYRUP.test(t)) return 'syrup';
  if (CAPSULE.test(t)) return SUSTAINED.test(t) ? 'capsule_sr' : 'capsule';
  if (TABLET.test(t)) return DISPERSIBLE.test(t) ? 'tablet_dt' : SUSTAINED.test(t) ? 'tablet_sr' : 'tablet';
  if (POWDER.test(t)) return 'powder';
  return null;
}

/** same form, a different known form, or at least one of them not known (then the match is allowed but said to be unconfirmed) */
export type FormRelation = 'same' | 'different' | 'unknown';
export function formRelation(a: string | null | undefined, b: string | null | undefined): FormRelation {
  if (!a || !b) return 'unknown';
  return a === b ? 'same' : 'different';
}
