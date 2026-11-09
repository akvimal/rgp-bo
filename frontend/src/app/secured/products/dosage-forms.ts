/**
 * The dosage forms a product can have, the same list as the server's (api-v2/src/modules/app/dictionary/dosage-form.ts). The form decides what counts as
 * "the same medicine" when looking for alternatives: a sustained-release tablet is not a plain tablet.
 */
export const DOSAGE_FORMS: { key: string; label: string }[] = [
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
];

export const dosageFormLabel = (key: string | null | undefined): string => DOSAGE_FORMS.find((f) => f.key === key)?.label ?? '';
