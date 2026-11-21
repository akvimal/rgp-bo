import { compositionKey } from '../sales/composition-match';
import { isDosageForm } from '../dictionary/dosage-form';

/**
 * Pure rules of the Counter guide (docs/planning/COUNTER_GUIDE.md): what the answers to the few questions mean for a card, and whether a card is fit to save.
 * Nothing here knows about stock or the database. The rules only ever remove options or advise a doctor; they never add a medicine the card did not list.
 */

/** who it is for: children under 2 and pregnant or breastfeeding women are always referred */
export const WHO = ['under2', 'child', 'adult', 'over60', 'pregnant'] as const;
export type Who = (typeof WHO)[number];
/** who an option may be given to (child is 2 to 12) */
export const AUDIENCES = ['child', 'adult', 'over60'] as const;
export type Audience = (typeof AUDIENCES)[number];

/** how long the problem has lasted */
export const DURATIONS = ['lt2', 'd2_3', 'd4_7', 'gt7'] as const;
export type Duration = (typeof DURATIONS)[number];
export const DURATION_LABELS: Record<Duration, string> = { lt2: 'Less than 2 days', d2_3: '2 to 3 days', d4_7: '4 to 7 days', gt7: 'More than a week' };
/** the fewest days each answer can mean; a card refers when this reaches its limit */
const DURATION_FROM: Record<Duration, number> = { lt2: 0, d2_3: 2, d4_7: 4, gt7: 8 };

/** the "anything else" ticks: what makes an option unsafe (or, for other_medicines, what the pharmacist must check) */
export const ISSUES = ['allergy_painkiller', 'allergy_antibiotic', 'ulcer_acidity', 'high_bp', 'diabetes', 'kidney_liver', 'asthma', 'blood_thinner', 'other_medicines'] as const;
export type Issue = (typeof ISSUES)[number];
export const ISSUE_LABELS: Record<Issue, string> = {
  allergy_painkiller: 'Allergy to painkillers (aspirin, ibuprofen and the like)',
  allergy_antibiotic: 'Allergy to antibiotics',
  ulcer_acidity: 'Stomach ulcer or frequent acidity',
  high_bp: 'High blood pressure',
  diabetes: 'Diabetes',
  kidney_liver: 'Kidney or liver problem',
  asthma: 'Asthma',
  blood_thinner: 'On a blood thinner',
  other_medicines: 'Taking other medicines now',
};

/** a picture for each "anything else" tick, shown on its tile at the counter */
export const ISSUE_ICONS: Record<Issue, string> = {
  allergy_painkiller: '🚫💊', allergy_antibiotic: '🚫🦠', ulcer_acidity: '🔥', high_bp: '💓', diabetes: '🍬',
  kidney_liver: '⚕️', asthma: '🌬️', blood_thinner: '🩸', other_medicines: '💊',
};

export interface GuideWarning { id: number; text: string; textTa?: string | null; icon?: string | null }
export interface GuideOption {
  id: number; composition: string; compositionKey: string | null; form: string | null; audiences: Audience[]; excludes: Issue[];
  /** how much and when, as the counter reads it: "1 (bf) - 0 - 1 (af)" (morning - noon - night; bf before food, af after food), or in words */
  dose?: string | null; days?: number | null;
  guidance?: string | null; guidanceTa?: string | null; sortOrder: number;
}
export interface GuideCard {
  id: number; key: string; name: string; nameTa?: string | null; icon?: string | null; asksDuration: boolean; durationLimitDays: number;
  referralText: string; referralTextTa?: string | null; warnings: GuideWarning[]; options: GuideOption[];
}
export interface Answers { who: Who; duration?: Duration | null; warnings: number[]; issues: Issue[] }

export interface Reason { kind: 'WHO' | 'WARNING' | 'DURATION' | 'NO_OPTION'; text: string }
export type Advice =
  | { refer: true; reasons: Reason[]; text: string; textTa?: string | null }
  | { refer: false; options: GuideOption[]; dropped: { option: GuideOption; because: string[] }[]; caution: boolean };

const audienceOf = (who: Who): Audience | null => (who === 'child' ? 'child' : who === 'adult' ? 'adult' : who === 'over60' ? 'over60' : null);

/**
 * What the answers mean. A doctor is advised (and no medicine shown) for: a child under 2, pregnancy or breastfeeding, any warning sign ticked, or a problem
 * that has lasted as long as the card's limit. Otherwise the card's options for that person, in the card's order, with any that the "anything else" ticks
 * rule out removed (and said why). A tick for other medicines removes nothing but asks the pharmacist to check.
 */
export function advise(card: GuideCard, a: Answers): Advice {
  const reasons: Reason[] = [];
  const refer = (): Advice => ({ refer: true, reasons, text: card.referralText, textTa: card.referralTextTa ?? null });

  if (a.who === 'under2' || a.who === 'pregnant') {
    reasons.push({ kind: 'WHO', text: a.who === 'under2' ? 'Children under 2 are always sent to a doctor.' : 'Pregnant or breastfeeding women are always sent to a doctor or the pharmacist.' });
    return refer();
  }
  for (const id of a.warnings || []) {
    const w = card.warnings.find((x) => x.id === Number(id));
    if (w) reasons.push({ kind: 'WARNING', text: w.text });
  }
  if (reasons.length) return refer();

  if (card.asksDuration) {
    if (!a.duration || !(a.duration in DURATION_FROM)) throw new Error('Say how long the problem has lasted.');
    if (DURATION_FROM[a.duration] >= card.durationLimitDays) {
      reasons.push({ kind: 'DURATION', text: `It has lasted ${DURATION_LABELS[a.duration].toLowerCase()}: a doctor should see it.` });
      return refer();
    }
  }

  const aud = audienceOf(a.who);
  const issues = new Set(a.issues || []);
  const options: GuideOption[] = [];
  const dropped: { option: GuideOption; because: string[] }[] = [];
  for (const o of card.options.slice().sort((x, y) => x.sortOrder - y.sortOrder)) {
    if (!aud || !o.audiences.includes(aud)) { dropped.push({ option: o, because: ['not for this age'] }); continue; }
    const hit = o.excludes.filter((e) => issues.has(e));
    if (hit.length) { dropped.push({ option: o, because: hit.map((h) => ISSUE_LABELS[h]) }); continue; }
    options.push(o);
  }
  if (!options.length) {
    reasons.push({ kind: 'NO_OPTION', text: 'Nothing on this card is safe for these answers.' });
    return refer();
  }
  return { refer: false, options, dropped, caution: issues.has('other_medicines') };
}

// ------------------------------------------------------------------ the usual answers

/** the answers the counter assumes until someone changes them: who it is for, and how long. Warning signs and "anything else" always start as none. */
export interface GuideDefaults { who: Audience; duration: Duration }
export const BUILT_IN_DEFAULTS: GuideDefaults = { who: 'adult', duration: 'lt2' };

/**
 * The defaults from what was saved: a value that is not allowed falls back to the built-in one. Only a child, an adult or someone over 60 can be the usual
 * person: a child under 2 and pregnancy are always sent to a doctor, which is no way to start.
 */
export function cleanDefaults(raw: { who?: unknown; duration?: unknown } | null | undefined): GuideDefaults {
  const who = (AUDIENCES as readonly string[]).includes(String(raw?.who)) ? (String(raw?.who) as Audience) : BUILT_IN_DEFAULTS.who;
  const duration = (DURATIONS as readonly string[]).includes(String(raw?.duration)) ? (String(raw?.duration) as Duration) : BUILT_IN_DEFAULTS.duration;
  return { who, duration };
}

/** a new setting as typed, or what is wrong with it */
export function checkDefaults(raw: any): { ok: true; defaults: GuideDefaults } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!(AUDIENCES as readonly string[]).includes(String(raw?.who))) errors.push('Choose who the counter assumes: a child (2 to 12), an adult, or someone over 60.');
  if (!(DURATIONS as readonly string[]).includes(String(raw?.duration))) errors.push('Choose how long the counter assumes.');
  return errors.length ? { ok: false, errors } : { ok: true, defaults: { who: raw.who, duration: raw.duration } };
}

// ------------------------------------------------------------------ the dose, as the counter reads it

/** one part of a day: an amount (a number or a fraction, with an optional unit) and, in brackets, before food (bf) or after food (af) */
const SLOT = /^(\d+(?:\.\d+)?|\d\/\d)(?:\s*(?:ml|tab|tabs|cap|caps|sachet|sachets|drop|drops|puff|puffs|g|mg))?(?:\s*\(\s*(bf|af)\s*\))?$/i;
export interface DoseSlot { amount: string; when: 'bf' | 'af' | null }

/** "1 (bf) - 0 - 1 (af)" -> morning, noon and night; null when it is not written that way (a dose in words is allowed: see looksLikeSlots) */
export function doseSlots(dose: string | null | undefined): DoseSlot[] | null {
  const parts = String(dose ?? '').trim().split(/\s*-\s*/);
  if (parts.length !== 3) return null;
  const slots: DoseSlot[] = [];
  for (const p of parts) {
    const m = SLOT.exec(p.trim());
    if (!m) return null;
    slots.push({ amount: p.trim().replace(/\s*\(\s*(bf|af)\s*\)\s*$/i, ''), when: m[2] ? (m[2].toLowerCase() as 'bf' | 'af') : null });
  }
  return slots;
}

/** written like morning - noon - night (digits either side of dashes) but maybe wrong: it must then read properly */
export const looksLikeSlots = (dose: string): boolean => /\d\s*(\([^)]*\))?\s*-\s*\d/.test(dose);

// ------------------------------------------------------------------ a card fit to save

export interface CardInput {
  key: string; name: string; nameTa?: string | null; icon?: string | null; asksDuration?: boolean; durationLimitDays: number; referralText: string; referralTextTa?: string | null; sortOrder?: number;
  warnings: { text: string; textTa?: string | null; icon?: string | null }[];
  options: { composition: string; form?: string | null; audiences: string[]; excludes?: string[]; dose?: string | null; days?: number | null; guidance?: string | null; guidanceTa?: string | null }[];
}

const cut = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const cutText = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
/** a picture: an emoji or two, no spaces or control characters */
const cutIcon = (v: unknown) => Array.from(String(v ?? '').replace(/[\s\u0000-\u001f]/g, '')).slice(0, 8).join('') || null;

/** a card that can be saved, or what is wrong with it: a card with fewer than two warning signs, or an option with no strength to match on, is not safe to use */
export function validateCard(raw: any): { ok: true; card: CardInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const key = cut(raw?.key, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(key)) errors.push('The key is 2 to 40 letters, numbers, - or _.');
  const name = cut(raw?.name, 120);
  if (name.length < 2) errors.push('Give the problem a name.');
  const limit = Number(raw?.durationLimitDays);
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) errors.push('Say after how many days a doctor should see it (1 to 30).');
  const referralText = cutText(raw?.referralText, 600);
  if (referralText.length < 5) errors.push('Write what to say when a doctor is advised.');

  const warnings = (Array.isArray(raw?.warnings) ? raw.warnings : []).map((w: any) => ({ text: cut(w?.text, 300), textTa: cut(w?.textTa, 400) || null, icon: cutIcon(w?.icon) })).filter((w: any) => w.text);
  if (warnings.length < 2) errors.push('A card needs at least two warning signs.');
  if (warnings.length > 12) errors.push('A card has at most 12 warning signs.');
  if (warnings.some((w: any) => w.text.length < 3)) errors.push('Each warning sign needs words.');

  const options: CardInput['options'] = [];
  const rawOptions = Array.isArray(raw?.options) ? raw.options : [];
  if (!rawOptions.length) errors.push('A card needs at least one option.');
  if (rawOptions.length > 8) errors.push('A card has at most 8 options.');
  rawOptions.slice(0, 8).forEach((o: any, i: number) => {
    const n = i + 1;
    const composition = cut(o?.composition, 300);
    const k = compositionKey(composition);
    if (!composition || !k || !k.hasStrength) errors.push(`Option ${n}: write the composition with its strength, for example "Paracetamol 500 mg".`);
    const form = cut(o?.form, 40) || null;
    if (form && !isDosageForm(form)) errors.push(`Option ${n}: "${form}" is not a dosage form on the list.`);
    const audiences = (Array.isArray(o?.audiences) ? o.audiences : []).map(String);
    if (!audiences.length || audiences.some((a: string) => !(AUDIENCES as readonly string[]).includes(a))) errors.push(`Option ${n}: say who it is for (child 2 to 12, adult, over 60).`);
    const excludes = (Array.isArray(o?.excludes) ? o.excludes : []).map(String);
    if (excludes.some((e: string) => !(ISSUES as readonly string[]).includes(e))) errors.push(`Option ${n}: an unknown "do not give with" tick.`);
    const dose = cut(o?.dose, 120);
    if (dose.length < 2) errors.push(`Option ${n}: write the dose, for example "1 (bf) - 0 - 1 (af)".`);
    else if (looksLikeSlots(dose) && !doseSlots(dose)) errors.push(`Option ${n}: write the dose as morning - noon - night, for example "1 (bf) - 0 - 1 (af)" (bf before food, af after food).`);
    const days = Number(o?.days);
    if (!Number.isInteger(days) || days < 1 || days > 30) errors.push(`Option ${n}: say for how many days (1 to 30).`);
    options.push({ composition, form, audiences: Array.from(new Set(audiences)), excludes: Array.from(new Set(excludes)), dose, days: Number.isInteger(days) ? days : null, guidance: cutText(o?.guidance, 600) || null, guidanceTa: cutText(o?.guidanceTa, 800) || null });
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, card: { key, name, nameTa: cut(raw?.nameTa, 160) || null, icon: cutIcon(raw?.icon), asksDuration: raw?.asksDuration !== false, durationLimitDays: limit, referralText, referralTextTa: cutText(raw?.referralTextTa, 800) || null, sortOrder: Number.isInteger(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : 100, warnings, options } };
}
