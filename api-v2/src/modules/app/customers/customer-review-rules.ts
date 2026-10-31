import { greetingName } from './customer-export';

/** how long after a bill the invitation is still offered at the counter (reopening an old bill does not ask again) */
export const INVITE_WINDOW_HOURS = 3;

export interface InviteFacts {
  total: number;
  minAmount: number;
  hasLink: boolean;
  /** the customer on the bill has a real mobile number (not the walk-in placeholder) */
  hasMobile: boolean;
  optOut: boolean;
  doNotContact: boolean;
  /** YES / NO / null: a recorded "no" to messages is respected, but no "yes" is needed */
  consent: string | null;
  openGrievance: boolean;
  hasReturn: boolean;
  lastInviteDaysAgo: number | null;
  guardDays: number;
  billAgeHours: number;
}

export interface InviteDecision {
  eligible: boolean;
  /** a code; the "quiet" ones are not shown to the cashier (nothing to explain), the others are */
  reason: '' | 'no_customer' | 'small' | 'no_link' | 'old' | 'opted_out' | 'no_contact' | 'declined' | 'grievance' | 'returned' | 'recent';
}

/** Whether to offer the cashier the review invitation for a bill. The first matching reason wins. */
export function reviewInviteDecision(f: InviteFacts): InviteDecision {
  if (!f.hasMobile) return { eligible: false, reason: 'no_customer' };
  if (!f.hasLink) return { eligible: false, reason: 'no_link' };
  if (f.total < f.minAmount) return { eligible: false, reason: 'small' };
  if (f.billAgeHours > INVITE_WINDOW_HOURS) return { eligible: false, reason: 'old' };
  if (f.optOut) return { eligible: false, reason: 'opted_out' };
  if (f.doNotContact) return { eligible: false, reason: 'no_contact' };
  if (f.consent === 'NO') return { eligible: false, reason: 'declined' };
  if (f.openGrievance) return { eligible: false, reason: 'grievance' };
  if (f.hasReturn) return { eligible: false, reason: 'returned' };
  if (f.lastInviteDaysAgo !== null && f.lastInviteDaysAgo < f.guardDays) return { eligible: false, reason: 'recent' };
  return { eligible: true, reason: '' };
}

/** the words the cashier sends; it always carries a way to stop */
export function reviewMessage(customerName: string | null | undefined, storeName: string, link: string): string {
  return `Hello ${greetingName(customerName)}, thank you for shopping at ${storeName}. If you were happy with us, a short Google review would mean a lot: ${link}\n\nIf you would rather not get review requests, just reply STOP.`;
}

/** the reason shown to the cashier, or '' for the ones with nothing to say */
export function reasonText(d: InviteDecision, daysAgo: number | null): string {
  switch (d.reason) {
    case 'opted_out': return 'This customer asked not to be invited to review.';
    case 'no_contact': return 'This customer asked not to be contacted.';
    case 'declined': return 'This customer declined messages.';
    case 'grievance': return 'This customer has an open complaint: sort that out first.';
    case 'returned': return 'This bill has a return.';
    case 'recent': return `Invited ${daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`}: not asked again yet.`;
    default: return '';
  }
}
