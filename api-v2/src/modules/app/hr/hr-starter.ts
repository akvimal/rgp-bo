/**
 * Starter pay structure for the Setup screen (HR and payroll step). Pure: no framework, no database, so it is tested without either.
 *
 * Payroll holds no formulas: a pay component is a name and a kind, and the amount is typed per person. So nothing here works out PF, ESI or tax;
 * the statutory items are only offered as names to add, and the owner decides whether they apply and what to enter.
 * Everything is matched by code, so offering a set twice, or over what a business already has, adds only what is missing.
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

/** the same for every kind of business: what any shop with employees needs to run its first payroll */
export const STARTER: StarterItem[] = [
  { code: 'BASIC', name: 'Basic', kind: 'EARNING' },
  { code: 'HRA', name: 'House rent allowance', kind: 'EARNING' },
  { code: 'OTHERS', name: 'Other allowances', kind: 'EARNING' },
  { code: 'FIXED_DED', name: 'Fixed deduction', kind: 'DEDUCTION' },
  { code: 'CL', name: 'Casual leave', kind: 'LEAVE', paid: true, annual_days: 12 },
  { code: 'SL', name: 'Sick leave', kind: 'LEAVE', paid: true, annual_days: 6 },
  { code: 'EL', name: 'Earned leave', kind: 'LEAVE', paid: true, annual_days: 12 },
  { code: 'LWP', name: 'Leave without pay', kind: 'LEAVE', paid: false, annual_days: 0 },
];

/** common in India, never added unless the owner asks; the system does not calculate any of them */
export const SUGGESTIONS: StarterItem[] = [
  { code: 'PF', name: 'Provident fund (employee share)', kind: 'DEDUCTION', note: 'Usually required from 20 employees. You enter the amount for each person.' },
  { code: 'ESI', name: 'ESI (employee share)', kind: 'DEDUCTION', note: 'Applies to staff below the wage ceiling. You enter the amount for each person.' },
  { code: 'PT', name: 'Professional tax', kind: 'DEDUCTION', note: 'A state rule: some states have none. You enter the amount.' },
  { code: 'TDS', name: 'TDS on salary', kind: 'DEDUCTION', note: 'Only for staff whose pay is taxable at source.' },
  { code: 'DA', name: 'Dearness allowance', kind: 'EARNING' },
  { code: 'CONVEYANCE', name: 'Conveyance allowance', kind: 'EARNING' },
  { code: 'MEDICAL', name: 'Medical allowance', kind: 'EARNING' },
  { code: 'SPECIAL', name: 'Special allowance', kind: 'EARNING' },
  { code: 'OVERTIME', name: 'Overtime', kind: 'EARNING' },
  { code: 'BONUS', name: 'Festival bonus', kind: 'EARNING' },
  { code: 'INCENTIVE', name: 'Incentive or commission', kind: 'EARNING', note: 'KPI incentive is already paid as its own line; this is for any other kind.' },
  { code: 'PHARMACIST', name: 'Pharmacist allowance', kind: 'EARNING', businessType: 'pharmacy' },
  { code: 'ML', name: 'Maternity leave', kind: 'LEAVE', paid: true, annual_days: 182, note: 'Check the entitlement that applies to you before relying on the days.' },
];

export interface StarterRow extends StarterItem { have: boolean }
export interface StarterView { starter: StarterRow[]; suggestions: StarterRow[] }

/** what is on offer for a kind of business, each marked with whether the business already has it (by code) */
export function starterView(businessType: string, haveComponents: string[], haveLeave: string[]): StarterView {
  const mark = (i: StarterItem): StarterRow => ({ ...i, have: (i.kind === 'LEAVE' ? haveLeave : haveComponents).map((c) => c.toUpperCase()).includes(i.code) });
  return {
    starter: STARTER.map(mark),
    suggestions: SUGGESTIONS.filter((s) => !s.businessType || s.businessType === businessType).map(mark),
  };
}

/**
 * The items to add: the starter set ("starter"), and/or suggestions by code. Anything unknown, offered to another kind of business, or already
 * present is skipped, not an error, so a second press adds nothing.
 */
export function itemsToAdd(businessType: string, ask: { starter?: boolean; codes?: string[] }, haveComponents: string[], haveLeave: string[]): StarterItem[] {
  const view = starterView(businessType, haveComponents, haveLeave);
  const codes = new Set((ask.codes || []).map((c) => String(c).toUpperCase()));
  const pick = [...(ask.starter ? view.starter : []), ...view.suggestions.filter((s) => codes.has(s.code))];
  const seen = new Set<string>();
  return pick.filter((i) => {
    if (i.have || seen.has(i.code)) return false;
    seen.add(i.code);
    return true;
  });
}
