/**
 * The online register of Schedule H, H1 and X drugs (pharmacy pack). Pure rules, tested without a database: which schedules need the patient and the
 * prescriber on the bill, what must be given, and the register line made for each scheduled drug supplied.
 */

export const SCHEDULES = ['H1', 'H', 'X'] as const;
export type Schedule = typeof SCHEDULES[number];
export const DEFAULT_REQUIRED = 'H1,H,X';

/** the schedules a bill must carry details for: the setting is a list ("H1,H,X"); no setting means all three, an empty one means none */
export const parseRequired = (value: string | null | undefined): Schedule[] => {
  if (value === null || value === undefined) return [...SCHEDULES];
  return String(value).split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s): s is Schedule => (SCHEDULES as readonly string[]).includes(s));
};

export interface Detail {
  patient_name: string; patient_address: string; patient_age: string;
  prescriber_name: string; prescriber_reg_no: string; prescriber_address: string; rx_date: string | null;
}

const clean = (v: any, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function normaliseDetail(d: any): Detail {
  const rx = clean(d?.rx_date, 10);
  return {
    patient_name: clean(d?.patient_name, 100), patient_address: clean(d?.patient_address, 250), patient_age: clean(d?.patient_age, 10),
    prescriber_name: clean(d?.prescriber_name, 100), prescriber_reg_no: clean(d?.prescriber_reg_no, 40), prescriber_address: clean(d?.prescriber_address, 200),
    rx_date: /^\d{4}-\d{2}-\d{2}$/.test(rx) ? rx : null,
  };
}

/** what is still missing: the patient's name and address, the prescriber's name, and the prescriber's registration number or address */
export function detailProblems(raw: any, today: string = new Date().toISOString().slice(0, 10)): string[] {
  const d = normaliseDetail(raw);
  const out: string[] = [];
  if (d.patient_name.length < 2) out.push("the patient's name");
  if (d.patient_address.length < 5) out.push("the patient's address");
  if (d.prescriber_name.length < 3) out.push("the prescriber's name");
  if (!d.prescriber_reg_no && d.prescriber_address.length < 5) out.push("the prescriber's registration number or address");
  const given = clean(raw?.rx_date, 10);
  if (given && (d.rx_date === null || d.rx_date > today)) out.push('a valid prescription date (not in the future)');
  return out;
}

export interface BillLine { id?: number; itemid?: number; productid: number; batch?: string; qty: number; }
export interface ScheduledProduct { id: number; title: string; schedule: Schedule; pack: number | null; }
export interface ScheduledLine { line: BillLine; product: ScheduledProduct; }

/** the lines of a bill that are scheduled drugs */
export const scheduledLines = (lines: BillLine[], products: ScheduledProduct[]): ScheduledLine[] => {
  const by = new Map(products.map((p) => [p.id, p]));
  return lines.filter((l) => Number(l.qty) > 0 && by.has(Number(l.productid))).map((l) => ({ line: l, product: by.get(Number(l.productid)) as ScheduledProduct }));
};

/** the lines of a bill that a schedule in the required list covers */
export const requiredLines = (lines: ScheduledLine[], required: Schedule[]): ScheduledLine[] => lines.filter((l) => required.includes(l.product.schedule));

/** the register is numbered per schedule: H1-0007 */
export const serialLabel = (schedule: string, n: number) => `${schedule}-${String(n).padStart(4, '0')}`;

export interface EntryDraft {
  schedule: Schedule; sale_item_id: number | null; product_id: number; drug_name: string; batch: string | null; qty: number; pack: number | null;
  itemid: number | null;
}

/** one register line for each scheduled drug supplied on the bill */
export const draftEntries = (lines: ScheduledLine[]): EntryDraft[] => lines.map(({ line, product }) => ({
  schedule: product.schedule, sale_item_id: line.id ?? null, product_id: product.id, drug_name: product.title, batch: line.batch ? String(line.batch) : null,
  qty: Math.floor(Number(line.qty)), pack: product.pack ?? null, itemid: line.itemid ?? null,
}));

/** the schedules in a list of lines, in register order (H1 first) */
export const schedulesOf = (lines: ScheduledLine[]): Schedule[] => SCHEDULES.filter((s) => lines.some((l) => l.product.schedule === s));

// ------------------------------------------------------------------ how a supply stands with its prescription
/** the basis a register line records for its prescription; the first three are set by the panel when it is used, the others are chosen by the person */
export const RX_BASES = ['ATTACHED', 'ON_FILE', 'LAST_SUPPLY', 'SEEN', 'REGULAR', 'LATER', 'COULD_NOT', 'OTHER'] as const;
export type RxBasis = typeof RX_BASES[number];
export const RX_LABELS: Record<RxBasis | 'NONE', string> = {
  ATTACHED: 'Prescription attached', ON_FILE: 'Prescription on file', LAST_SUPPLY: 'Same as last supply', SEEN: 'Seen, not kept', REGULAR: 'Regular customer, earlier prescription',
  LATER: 'Will bring it later', COULD_NOT: 'Customer could not provide', OTHER: 'Other', NONE: 'No reason recorded',
};
/** a prescription promised for later is chased for at most this many days */
export const LATER_MAX_DAYS = 30;

export interface Rx { basis: RxBasis | null; note: string; due: string | null; documentId: number | null; }

const plusDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** the last prescription among the documents on a bill, if any */
export const prescriptionOf = (docs: any): any | null => {
  const list = Array.isArray(docs) ? docs.filter((d: any) => String(d?.category ?? '').toLowerCase() === 'prescription') : [];
  return list.length ? list[list.length - 1] : null;
};

/** the basis as the bill gives it; a prescription on the bill means ATTACHED unless the person took one already on file */
export function normaliseRx(raw: any, docs: any = []): Rx {
  const given = String(raw?.rx_basis ?? '').trim().toUpperCase();
  let basis: RxBasis | null = (RX_BASES as readonly string[]).includes(given) ? (given as RxBasis) : null;
  const doc = prescriptionOf(docs);
  if (doc && (basis === null || basis === 'LATER')) basis = 'ATTACHED';
  const due = clean(raw?.rx_due, 10);
  const asked = Number(raw?.rx_document_id);
  const docId = Number.isFinite(asked) && asked > 0 ? asked : doc && Number(doc.id) > 0 ? Number(doc.id) : null;
  return {
    basis, note: clean(raw?.rx_note, 200), due: basis === 'LATER' && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    documentId: basis === 'ATTACHED' || basis === 'ON_FILE' ? docId : null,
  };
}

/** what the basis still needs: a few words for "Other", and the day for "Will bring it later" */
export function rxProblems(raw: any, docs: any = [], today: string = new Date().toISOString().slice(0, 10)): string[] {
  const rx = normaliseRx(raw, docs);
  const out: string[] = [];
  if (rx.basis === 'OTHER' && rx.note.length < 3) out.push('a few words on why there is no prescription');
  if (rx.basis === 'LATER' && (!rx.due || rx.due < today || rx.due > plusDays(today, LATER_MAX_DAYS))) out.push(`the day the prescription will be brought (within ${LATER_MAX_DAYS} days)`);
  return out;
}

// ------------------------------------------------------------------ a prescription used again (standing use for chronic medicines)
export const DEFAULT_STANDING_MONTHS = 6;

/** a number of months, 1 to 24; anything else means the default */
export const parseStandingMonths = (value: any): number => {
  const n = Math.floor(Number(String(value ?? '').trim()));
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : DEFAULT_STANDING_MONTHS;
};

/** the day a prescription dated `day` stops being usable again: the same date `months` later (the last day of a shorter month) */
export function validUntil(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** whether a prescription dated `day` can still be used again today; one with no usable date is treated as expired */
export function standingState(day: string | null | undefined, today: string, months: number): { valid_until: string | null; expired: boolean } {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { valid_until: null, expired: true };
  const until = validUntil(day, months);
  return { valid_until: until, expired: until < today };
}
