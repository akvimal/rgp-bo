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
