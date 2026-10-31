import { InviteFacts, reasonText, reviewInviteDecision, reviewMessage } from './customer-review-rules';

const base: InviteFacts = {
  total: 800, minAmount: 500, hasLink: true, hasMobile: true, optOut: false, doNotContact: false, consent: null,
  openGrievance: false, hasReturn: false, lastInviteDaysAgo: null, guardDays: 90, billAgeHours: 0.2,
};
const decide = (over: Partial<InviteFacts>) => reviewInviteDecision({ ...base, ...over });

describe('review invitation', () => {
  it('is offered for a larger bill to a named customer, without any recorded consent', () => {
    expect(decide({ consent: null })).toEqual({ eligible: true, reason: '' });
    expect(decide({ consent: 'YES' }).eligible).toBe(true);
  });

  it('is not offered for a small bill, a walk-in, a store without a link, or an old bill', () => {
    expect(decide({ total: 499 }).reason).toBe('small');
    expect(decide({ total: 500 }).eligible).toBe(true);
    expect(decide({ hasMobile: false }).reason).toBe('no_customer');
    expect(decide({ hasLink: false }).reason).toBe('no_link');
    expect(decide({ billAgeHours: 5 }).reason).toBe('old');
  });

  it('respects a customer who asked to stop, who must not be contacted, or who declined messages', () => {
    expect(decide({ optOut: true }).reason).toBe('opted_out');
    expect(decide({ doNotContact: true }).reason).toBe('no_contact');
    expect(decide({ consent: 'NO' }).reason).toBe('declined');
  });

  it('does not ask someone with an open complaint, or on a bill with a return', () => {
    expect(decide({ openGrievance: true }).reason).toBe('grievance');
    expect(decide({ hasReturn: true }).reason).toBe('returned');
  });

  it('keeps the same customer from being asked again inside the guard period, and asks again after it', () => {
    expect(decide({ lastInviteDaysAgo: 30 }).reason).toBe('recent');
    expect(decide({ lastInviteDaysAgo: 89 }).reason).toBe('recent');
    expect(decide({ lastInviteDaysAgo: 90 }).eligible).toBe(true);
  });

  it('says why only when there is something to explain', () => {
    expect(reasonText(decide({ total: 100 }), null)).toBe('');
    expect(reasonText(decide({ optOut: true }), null)).toContain('asked not to be invited');
    expect(reasonText(decide({ lastInviteDaysAgo: 0 }), 0)).toContain('today');
  });

  it('writes a message with the first name, the store, the link and a way to stop', () => {
    const m = reviewMessage('Ms. Kathleen Dickinson', 'RGP Pharmacy', 'https://g.page/r/abc/review');
    expect(m).toContain('Hello Kathleen Sir/Madam,');
    expect(m).toContain('RGP Pharmacy');
    expect(m).toContain('https://g.page/r/abc/review');
    expect(m).toContain('reply STOP');
  });
});
