import { CardInput } from './counter-guide-rules';

/**
 * The starter cards: twelve everyday problems, written as a starting point for the pharmacist and added as DRAFTS only. A draft never reaches the counter;
 * a registered pharmacist reads each card, edits it to the shop's practice, and approves it. They are not medical advice and nothing in them has been
 * checked by a clinician. No doses are given: the guidance says "as directed on the pack or by the pharmacist". Tamil wording is left for the pharmacist to add.
 *
 * Options are listed by composition and form the way the brand dictionary writes them, so they match the shop's products. Where the shop writes a
 * composition differently a card option finds no stock: the card screen shows how many products each option matches, so the pharmacist can correct it.
 * Prescription-only products are never offered whatever a card says: the product's schedule decides at the counter.
 */

const SEE_DOCTOR = 'Please see a doctor, or the pharmacist on duty, for this. Medicines are not given from the counter for it.';
const ASDIRECTED = 'Use as directed on the pack or by the pharmacist. Do not give more than the pack says.';

const ADULT = ['adult', 'over60'];
const ALL = ['child', 'adult', 'over60'];

const PARA_ADULT = { composition: 'Paracetamol 500 mg', form: 'tablet', audiences: ADULT, excludes: ['kidney_liver'], guidance: 'Take after food. ' + ASDIRECTED };
const PARA_CHILD = { composition: 'Paracetamol 125 mg/5 ml', form: 'syrup', audiences: ['child'], excludes: [], guidance: 'The dose depends on the child\'s weight: the pharmacist gives it. ' + ASDIRECTED };
const IBU = { composition: 'Ibuprofen 400 mg', form: 'tablet', audiences: ['adult'], excludes: ['allergy_painkiller', 'ulcer_acidity', 'kidney_liver', 'asthma', 'blood_thinner', 'high_bp'], guidance: 'Take after food. ' + ASDIRECTED };
const ORS = { composition: 'Glucose 13.5 g + Sodium chloride 2.6 g + Potassium chloride 1.5 g + Sodium citrate 2.9 g', form: 'powder', audiences: ALL, excludes: [], guidance: 'Mix with clean water as on the pack and sip often. Throw away what is left after 24 hours.' };
const ANTACID = { composition: 'Aluminium hydroxide 250 mg + Magnesium hydroxide 250 mg', form: 'syrup', audiences: ADULT, excludes: ['kidney_liver'], guidance: 'Take between meals or at bedtime. ' + ASDIRECTED };

const RAW: CardInput[] = [
  {
    key: 'headache', name: 'Headache', durationLimitDays: 3, referralText: SEE_DOCTOR, sortOrder: 10,
    warnings: [
      { text: 'A sudden, very severe headache (the worst ever)' },
      { text: 'Fever with a stiff neck or a rash' },
      { text: 'After a blow to the head' },
      { text: 'Drowsy, confused, fainting or a fit' },
      { text: 'Blurred or double vision, weakness, or trouble speaking' },
    ],
    options: [PARA_ADULT, { ...IBU }, PARA_CHILD],
  },
  {
    key: 'headache-vomiting', name: 'Headache with vomiting', durationLimitDays: 2, referralText: SEE_DOCTOR, sortOrder: 20,
    warnings: [
      { text: 'A sudden, very severe headache (the worst ever)' },
      { text: 'Fever with a stiff neck or a rash' },
      { text: 'After a blow to the head' },
      { text: 'Drowsy, confused, fainting or a fit' },
      { text: 'Blurred or double vision, weakness, or trouble speaking' },
      { text: 'Vomiting more than three times, for over a day, or unable to keep fluids down' },
      { text: 'Signs of dehydration: very dry mouth, little urine, dizziness' },
    ],
    options: [ORS, PARA_ADULT, PARA_CHILD],
  },
  {
    key: 'fever', name: 'Fever', durationLimitDays: 3, referralText: SEE_DOCTOR, sortOrder: 30,
    warnings: [
      { text: 'A very high fever (above 103 F / 39.4 C)' },
      { text: 'Fever with a rash, bleeding, or severe body pain' },
      { text: 'Stiff neck, severe headache, or a fit' },
      { text: 'Fast or difficult breathing' },
      { text: 'Drowsy, confused, or not passing urine' },
    ],
    options: [PARA_ADULT, PARA_CHILD],
  },
  {
    key: 'cold', name: 'Cold and blocked nose', durationLimitDays: 7, referralText: SEE_DOCTOR, sortOrder: 40,
    warnings: [
      { text: 'Difficulty breathing or a wheeze' },
      { text: 'Chest pain' },
      { text: 'A high fever that lasts more than 3 days' },
      { text: 'Pain in the face or ear with fever' },
      { text: 'Coughing up thick yellow or green phlegm with fever' },
    ],
    options: [
      { composition: 'Cetirizine 10 mg', form: 'tablet', audiences: ADULT, excludes: ['kidney_liver'], guidance: 'It can cause drowsiness: do not drive afterwards. ' + ASDIRECTED },
      PARA_ADULT, PARA_CHILD,
    ],
  },
  {
    key: 'sore-throat', name: 'Sore throat', durationLimitDays: 5, referralText: SEE_DOCTOR, sortOrder: 50,
    warnings: [
      { text: 'Difficulty swallowing or breathing, or drooling' },
      { text: 'A swollen neck or white patches in the throat' },
      { text: 'A high fever for more than 2 days' },
      { text: 'A rash' },
    ],
    options: [PARA_ADULT, PARA_CHILD],
  },
  {
    key: 'stomach-pain', name: 'Stomach pain', durationLimitDays: 2, referralText: SEE_DOCTOR, sortOrder: 60,
    warnings: [
      { text: 'Severe or constant pain' },
      { text: 'Pain low on the right side of the tummy' },
      { text: 'Black stools, or blood in the stool or vomit' },
      { text: 'Fever' },
      { text: 'A hard, swollen tummy, or pain after an injury' },
    ],
    options: [ANTACID],
  },
  {
    key: 'acidity', name: 'Acidity and heartburn', durationLimitDays: 14, referralText: SEE_DOCTOR, sortOrder: 70,
    warnings: [
      { text: 'Chest pain, or pain spreading to the arm or jaw, or sweating' },
      { text: 'Difficulty swallowing' },
      { text: 'Vomiting blood or black stools' },
      { text: 'Losing weight without trying' },
      { text: 'Acidity for the first time after the age of 50' },
    ],
    options: [ANTACID, { composition: 'Calcium carbonate 500 mg', form: 'tablet', audiences: ADULT, excludes: ['kidney_liver'], guidance: 'Chew after meals. ' + ASDIRECTED }],
  },
  {
    key: 'loose-motions', name: 'Loose motions', durationLimitDays: 2, referralText: SEE_DOCTOR, sortOrder: 80,
    warnings: [
      { text: 'Blood or mucus in the stool' },
      { text: 'A high fever' },
      { text: 'Signs of dehydration: very dry mouth, sunken eyes, no urine for 8 hours' },
      { text: 'Vomiting so that fluids cannot be kept down' },
      { text: 'Severe tummy pain, or a child who is drowsy or will not drink' },
    ],
    options: [ORS, { composition: 'Zinc 20 mg', form: 'tablet_dt', audiences: ['child'], excludes: [], guidance: 'The pharmacist gives the dose and the number of days.' }],
  },
  {
    key: 'vomiting', name: 'Vomiting', durationLimitDays: 2, referralText: SEE_DOCTOR, sortOrder: 90,
    warnings: [
      { text: 'Blood in the vomit, or green vomit' },
      { text: 'Severe tummy pain' },
      { text: 'A headache with a stiff neck, or a blow to the head' },
      { text: 'Drowsy or confused' },
      { text: 'Signs of dehydration, or unable to keep fluids down for 12 hours' },
    ],
    options: [ORS],
  },
  {
    key: 'constipation', name: 'Constipation', durationLimitDays: 7, referralText: SEE_DOCTOR, sortOrder: 100,
    warnings: [
      { text: 'Severe tummy pain or vomiting' },
      { text: 'Blood in the stool' },
      { text: 'Losing weight without trying' },
      { text: 'A new change in bowels after the age of 50' },
    ],
    options: [
      { composition: 'Ispaghula husk 3.5 g', form: 'powder', audiences: ADULT, excludes: [], guidance: 'Mix in a full glass of water and drink plenty of water through the day. ' + ASDIRECTED },
      { composition: 'Lactulose 3.35 g/5 ml', form: 'syrup', audiences: ADULT, excludes: ['kidney_liver'], guidance: ASDIRECTED },
    ],
  },
  {
    key: 'minor-burn', name: 'Minor burn', asksDuration: false, durationLimitDays: 3, referralText: SEE_DOCTOR, sortOrder: 110,
    warnings: [
      { text: 'Bigger than the palm of the hand' },
      { text: 'On the face, eyes, hands, feet, genitals or over a joint' },
      { text: 'Large blisters, or skin that looks white or charred' },
      { text: 'A chemical or electrical burn' },
      { text: 'Signs of infection: pus, spreading redness, or fever' },
    ],
    options: [{ composition: 'Povidone iodine 5 %', form: 'topical', audiences: ALL, excludes: ['kidney_liver'], guidance: 'First cool the burn under running water for 20 minutes. Do not burst blisters or put toothpaste, oil or butter on it.' }],
  },
  {
    key: 'minor-cut', name: 'Minor cut or scrape', asksDuration: false, durationLimitDays: 3, referralText: SEE_DOCTOR, sortOrder: 120,
    warnings: [
      { text: 'Bleeding that does not stop after 10 minutes of firm pressure' },
      { text: 'Deep or gaping, or something stuck in the wound' },
      { text: 'An animal or human bite' },
      { text: 'A dirty or rusty object, and no tetanus injection in the last 5 years' },
      { text: 'Signs of infection: pus, spreading redness, or fever' },
    ],
    options: [{ composition: 'Povidone iodine 5 %', form: 'topical', audiences: ALL, excludes: ['kidney_liver'], guidance: 'Wash with clean running water first and press with a clean cloth to stop bleeding. Keep it clean and covered.' }],
  },
];

/** a picture for each card (an emoji: it needs no image file and reads the same in English and Tamil); the pharmacist can change any of them */
const CARD_ICONS: Record<string, string> = {
  headache: '🤕', 'headache-vomiting': '🤕🤮', fever: '🌡️', cold: '🤧', 'sore-throat': '😷', 'stomach-pain': '😖',
  acidity: '🥵', 'loose-motions': '🚽', vomiting: '🤮', constipation: '😣', 'minor-burn': '🔥', 'minor-cut': '🩹',
};

/** a picture for a warning sign, from what it says; a sign nothing fits gets a plain warning mark */
export function warningIcon(text: string): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/fever|temperature/, '🌡️'], [/blood|bleed/, '🩸'], [/vomit/, '🤮'], [/drows|confus|faint|\bfit\b/, '😵'], [/vision/, '👁️'],
    [/head/, '🤕'], [/breath|wheeze/, '😮'], [/rash/, '🔴'], [/infection|pus/, '🦠'], [/dehydrat|dry mouth|urine/, '💧'],
    [/swallow|throat|neck/, '😷'], [/weight/, '⚖️'], [/chest/, '❤️'], [/electrical/, '⚡'], [/chemical|burn|blister/, '🔥'],
    [/bite/, '🐾'], [/tetanus|rusty|dirty/, '🧷'], [/pain|tummy|stool/, '😖'],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? '⚠️';
}

export const STARTER_CARDS: CardInput[] = RAW.map((c) => ({ ...c, icon: CARD_ICONS[c.key] ?? null, warnings: c.warnings.map((w) => ({ ...w, icon: warningIcon(w.text) })) }));
