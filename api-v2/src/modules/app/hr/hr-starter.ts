/**
 * Starter pay structure for the Setup screen (HR and payroll step). Pure: no framework, no database, so it is tested without either.
 *
 * Payroll holds no formulas: a pay component is a name and a kind, and the amount is typed per person. So nothing here works out PF, ESI or tax;
 * the statutory items are only offered as names to add, and the owner decides whether they apply and what to enter.
 * Everything is matched by code, so offering a set twice, or over what a business already has, adds only what is missing.
 *
 * How strict the set is follows how the business is registered. A limited company gets the compliance set and has to record a decision on each
 * statutory item; every other business gets the lite set. Moving from lite to compliance later only adds what is missing.
 */

export type StarterKind = 'EARNING' | 'DEDUCTION' | 'LEAVE';

export interface StarterItem {
  code: string;
  name: string;
  kind: StarterKind;
  /** leave only */
  paid?: boolean;
  annual_days?: number;
  /** one line the owner reads before adding */
  note?: string;
  /** offered only to this kind of business */
  businessType?: string;
}

// ------------------------------------------------------------------ how the business is registered
export const LEGAL_FORMS = ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OTHER'] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];
export const LEGAL_FORM_LABELS: Record<LegalForm, string> = {
  PROPRIETORSHIP: 'Proprietorship', PARTNERSHIP: 'Partnership firm', LLP: 'Limited liability partnership (LLP)',
  PRIVATE_LIMITED: 'Private limited company', PUBLIC_LIMITED: 'Public limited company', OTHER: 'Other (trust, society, ...)',
};
export const isLegalForm = (v: any): v is LegalForm => (LEGAL_FORMS as readonly string[]).includes(v);

export type PayrollMode = 'LITE' | 'COMPLIANCE';
/** limited companies follow the compliance set; everything else is lite. Anything unknown is lite, so nothing is ever forced on a business. */
export function payrollMode(form: string | null | undefined): PayrollMode {
  return form === 'PRIVATE_LIMITED' || form === 'PUBLIC_LIMITED' ? 'COMPLIANCE' : 'LITE';
}

// ------------------------------------------------------------------ the items
const ITEMS: StarterItem[] = [
  { code: 'BASIC', name: 'Base salary', kind: 'EARNING' },
  { code: 'DA', name: 'Dearness allowance', kind: 'EARNING' },
  { code: 'OTHERS', name: 'Misc', kind: 'EARNING', note: 'Any other fixed allowance, for example the pharmacist allowance.' },
  { code: 'HRA', name: 'House rent allowance', kind: 'EARNING' },
  { code: 'SPECIAL', name: 'Special allowance', kind: 'EARNING' },
  { code: 'CONVEYANCE', name: 'Conveyance allowance', kind: 'EARNING' },
  { code: 'MEDICAL', name: 'Medical allowance', kind: 'EARNING' },
  { code: 'OVERTIME', name: 'Overtime', kind: 'EARNING' },
  { code: 'BONUS', name: 'Festival bonus', kind: 'EARNING' },
  { code: 'INCENTIVE', name: 'Incentive or commission', kind: 'EARNING', note: 'KPI incentive is worked out by the system and paid as its own line; this is for any other kind.' },
  { code: 'PHARMACIST', name: 'Pharmacist allowance', kind: 'EARNING', businessType: 'pharmacy' },
  { code: 'FIXED_DED', name: 'Other deductions', kind: 'DEDUCTION' },
  { code: 'PF', name: 'Provident fund (employee share)', kind: 'DEDUCTION', note: 'Usually required from 20 employees. You enter the amount for each person.' },
  { code: 'ESI', name: 'ESI (employee share)', kind: 'DEDUCTION', note: 'Applies to staff below the wage ceiling. You enter the amount for each person.' },
  { code: 'PT', name: 'Professional tax', kind: 'DEDUCTION', note: 'A state rule: some states have none. You enter the amount.' },
  { code: 'TDS', name: 'TDS on salary', kind: 'DEDUCTION', note: 'Only for staff whose pay is taxable at source.' },
  { code: 'CL', name: 'Casual leave', kind: 'LEAVE', paid: true, annual_days: 12 },
  { code: 'SL', name: 'Sick leave', kind: 'LEAVE', paid: true, annual_days: 6 },
  { code: 'EL', name: 'Earned leave', kind: 'LEAVE', paid: true, annual_days: 12 },
  { code: 'LWP', name: 'Leave without pay', kind: 'LEAVE', paid: false, annual_days: 0 },
  { code: 'ML', name: 'Maternity leave', kind: 'LEAVE', paid: true, annual_days: 182, note: 'Check the entitlement that applies to you before relying on the days.' },
];

/** the first payroll of a small business, as a proprietor runs it: a base, an allowance or two, one deduction line, and the usual leave */
const LITE_CODES = ['BASIC', 'DA', 'OTHERS', 'FIXED_DED', 'CL', 'SL', 'EL', 'LWP'];
/** a limited company: the lite set plus the statutory deductions and the allowances a salary structure usually splits into */
const COMPLIANCE_CODES = ['BASIC', 'DA', 'HRA', 'SPECIAL', 'OTHERS', 'PF', 'ESI', 'PT', 'TDS', 'FIXED_DED', 'CL', 'SL', 'EL', 'LWP', 'ML'];

const byCode = (c: string) => ITEMS.find((i) => i.code === c)!;
export const STARTER_BY_MODE: Record<PayrollMode, StarterItem[]> = { LITE: LITE_CODES.map(byCode), COMPLIANCE: COMPLIANCE_CODES.map(byCode) };
/** the lite set, kept as the default name for callers that do not care about the mode */
export const STARTER: StarterItem[] = STARTER_BY_MODE.LITE;
/** everything else in the catalogue, for the mode: offered, never added unless the owner asks */
export const suggestionsFor = (mode: PayrollMode): StarterItem[] => ITEMS.filter((i) => !(mode === 'LITE' ? LITE_CODES : COMPLIANCE_CODES).includes(i.code));
export const SUGGESTIONS: StarterItem[] = suggestionsFor('LITE');

// ------------------------------------------------------------------ statutory decisions (compliance mode)
export interface StatutoryItem { code: string; name: string; note: string; reg_label?: string }
export const STATUTORY: StatutoryItem[] = [
  { code: 'PF', name: 'Provident fund', note: 'Normally required from 20 employees, with a wage ceiling; below that it is optional.', reg_label: 'PF establishment code' },
  { code: 'ESI', name: 'ESI', note: 'Normally required from 10 employees, for staff below the wage ceiling.', reg_label: 'ESI employer code' },
  { code: 'PT', name: 'Professional tax', note: 'A state tax: the employer registers and deducts it in states that levy it.', reg_label: 'PT enrolment number' },
  { code: 'TDS', name: 'Tax deducted at source on salary', note: 'When an employee\'s pay is taxable, the employer deducts and deposits the tax.', reg_label: 'TAN' },
  { code: 'GRATUITY', name: 'Gratuity', note: 'Payable after five years of service where the Act applies to the establishment.' },
  { code: 'BONUS', name: 'Statutory bonus', note: 'Applies to establishments above the employee threshold, for staff below the wage ceiling.' },
];

export interface Decision { code: string; applies: boolean; reason: string | null; reg_no: string | null }

/** one decision from the screen: the answer is yes or no; a no needs a reason; the registration number is only for items that have one */
export function checkDecision(code: string, input: any): { error: string } | { value: Decision } {
  const item = STATUTORY.find((s) => s.code === String(code).toUpperCase());
  if (!item) return { error: 'That is not a statutory item.' };
  if (typeof input?.applies !== 'boolean') return { error: `Say whether ${item.name} applies.` };
  const reason = String(input.reason ?? '').trim().replace(/\s+/g, ' ');
  if (reason.length > 200) return { error: 'The reason can be at most 200 characters.' };
  if (!input.applies && reason.length < 3) return { error: `Say why ${item.name} does not apply.` };
  const reg = String(input.reg_no ?? '').trim().toUpperCase();
  if (reg.length > 40) return { error: 'The registration number can be at most 40 characters.' };
  return { value: { code: item.code, applies: input.applies, reason: input.applies ? null : reason, reg_no: item.reg_label && input.applies && reg ? reg : null } };
}

export interface StatutoryRow extends StatutoryItem { applies: boolean | null; reason: string | null; reg_no: string | null }
export function statutoryView(decisions: Decision[]): StatutoryRow[] {
  return STATUTORY.map((s) => {
    const d = decisions.find((x) => x.code === s.code);
    return { ...s, applies: d ? d.applies : null, reason: d?.reason ?? null, reg_no: d?.reg_no ?? null };
  });
}

/** compliance only: how many of the statutory items have an answer. A yes also wants its registration number, which is counted apart. */
export function statutoryProgress(decisions: Decision[]): { decided: number; total: number; missing_reg: string[] } {
  const rows = statutoryView(decisions);
  return { decided: rows.filter((r) => r.applies !== null).length, total: rows.length, missing_reg: rows.filter((r) => r.applies && r.reg_label && !r.reg_no).map((r) => r.code) };
}

// ------------------------------------------------------------------ job roles
/** job roles offered with no pay structure: the owner enters the amounts, as with PF and ESI. The login role is the usual one, a hint and no more. */
export interface StarterRole { name: string; login_role: string | null; businessType?: string }
export const STARTER_ROLES: StarterRole[] = [
  { name: 'Store manager', login_role: 'Store Head' },
  { name: 'Sales staff', login_role: 'Sales Staff' },
  { name: 'Pharmacist', login_role: null, businessType: 'pharmacy' },
];

/** the job roles on offer for a kind of business that the business does not have yet (by name, any case) */
export function rolesToAdd(businessType: string, haveNames: string[]): StarterRole[] {
  const have = new Set(haveNames.map((n) => n.trim().toLowerCase()));
  return STARTER_ROLES.filter((r) => (!r.businessType || r.businessType === businessType) && !have.has(r.name.toLowerCase()));
}

export interface StarterRow extends StarterItem { have: boolean }
export interface StarterView { starter: StarterRow[]; suggestions: StarterRow[] }

/** what is on offer for a kind of business and a payroll mode, each marked with whether the business already has it (by code) */
export function starterView(businessType: string, haveComponents: string[], haveLeave: string[], mode: PayrollMode = 'LITE'): StarterView {
  const mark = (i: StarterItem): StarterRow => ({ ...i, have: (i.kind === 'LEAVE' ? haveLeave : haveComponents).map((c) => c.toUpperCase()).includes(i.code) });
  return {
    starter: STARTER_BY_MODE[mode].map(mark),
    suggestions: suggestionsFor(mode).filter((s) => !s.businessType || s.businessType === businessType).map(mark),
  };
}

/**
 * The items to add: the starter set ("starter"), and/or suggestions by code. Anything unknown, offered to another kind of business, or already
 * present is skipped, not an error, so a second press adds nothing.
 */
export function itemsToAdd(businessType: string, ask: { starter?: boolean; codes?: string[] }, haveComponents: string[], haveLeave: string[], mode: PayrollMode = 'LITE'): StarterItem[] {
  const view = starterView(businessType, haveComponents, haveLeave, mode);
  const codes = new Set((ask.codes || []).map((c) => String(c).toUpperCase()));
  const pick = [...(ask.starter ? view.starter : []), ...view.suggestions.filter((s) => codes.has(s.code))];
  const seen = new Set<string>();
  return pick.filter((i) => {
    if (i.have || seen.has(i.code)) return false;
    seen.add(i.code);
    return true;
  });
}
