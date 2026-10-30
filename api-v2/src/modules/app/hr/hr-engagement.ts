/**
 * How a person relates to the business, and whether payroll pays them. Pure: no framework, no database.
 *
 * An owner or partner is not an employee: what they take is drawings or remuneration under the deed, not salary, so they never go through payroll.
 * A director of a limited company can be paid a salary, so a director goes on payroll only when the owner says so. Everyone else is an employee.
 * Which of owner or director is offered follows how the business is registered.
 */
import { payrollMode } from './hr-starter';

export const RELATIONSHIPS = ['EMPLOYEE', 'OWNER', 'DIRECTOR'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface Engagement { relationship: Relationship; on_payroll: boolean }

/** what the business may choose for a person, in the order the screen offers it */
export function relationshipsFor(legalForm: string | null | undefined): Relationship[] {
  return payrollMode(legalForm) === 'COMPLIANCE' ? ['EMPLOYEE', 'DIRECTOR'] : ['EMPLOYEE', 'OWNER'];
}

/** the relationship the person doing the set-up (the owner) starts with */
export const ownerDefault = (legalForm: string | null | undefined): Relationship => (payrollMode(legalForm) === 'COMPLIANCE' ? 'DIRECTOR' : 'OWNER');

/** the relationship and payroll switch to store, or the reason they cannot be; with nothing given the person is an employee on payroll */
export function checkEngagement(legalForm: string | null | undefined, relationship: any, onPayroll: any): { error: string } | { value: Engagement } {
  const rel = relationship === undefined || relationship === null || relationship === '' ? 'EMPLOYEE' : relationship;
  if (!(RELATIONSHIPS as readonly string[]).includes(rel)) return { error: 'Choose employee, owner or partner, or director.' };
  if (rel === 'EMPLOYEE') return { value: { relationship: 'EMPLOYEE', on_payroll: true } };
  if (!relationshipsFor(legalForm).includes(rel as Relationship)) {
    return { error: rel === 'OWNER' ? 'In a limited company the owner is recorded as a director.' : 'Only a limited company has directors. Record the owner or a partner as an owner or partner.' };
  }
  if (rel === 'OWNER') return { value: { relationship: 'OWNER', on_payroll: false } };
  return { value: { relationship: 'DIRECTOR', on_payroll: onPayroll === true } };
}
