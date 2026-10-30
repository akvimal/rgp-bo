/**
 * Rules for removing a login and for an email address. Pure: no framework, no database, so they are tested without either.
 *
 * Removing a login only deactivates it, which stops it signing in. Two removals would lock a business out of its own account, so they are refused:
 * a person removing themselves, and removing the last active Business Head (or Owner-operator).
 */
import { OWNER_ROLES } from './roles';

/** why a removal is refused, or null when it may go ahead. `otherActiveHeads` counts the business's other active head logins. */
export function removalBlock(callerId: number, targetId: number, targetRole: string | null | undefined, otherActiveHeads: number): string | null {
  if (callerId === targetId) return 'You cannot remove your own account. Ask another Business Head to do it.';
  if (targetRole && OWNER_ROLES.includes(targetRole) && otherActiveHeads < 1) {
    return `This is the only active ${targetRole} of the business, so it cannot be removed: nobody could sign in to manage it. Ask your platform administrator to add another ${targetRole} first.`;
  }
  return null;
}

/** the email trimmed, or the reason it cannot be used. The login name is the email, so it must look like one and fit the column. */
export function emailProblem(email: any): { error: string } | { value: string } {
  const e = typeof email === 'string' ? email.trim() : '';
  if (!e) return { error: 'The email is required: it is the login name.' };
  if (e.length > 40) return { error: 'The email can be at most 40 characters.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'That does not look like an email address.' };
  return { value: e };
}

/** the message for an email another login already holds; a removed login still holds its email, because emails are unique for good */
export function emailTakenMessage(holderRemoved: boolean): string {
  return holderRemoved
    ? 'That email belonged to a login that was removed, and it cannot be used again. Use a different email.'
    : 'That email is already used by another login.';
}
