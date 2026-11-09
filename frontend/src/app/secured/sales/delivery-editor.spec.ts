import { buildCostPaid, choiceOf, costLabel, costProblem, deliveredByKind, nowLocalInput, receiverSummary, wallClock } from './delivery-editor';

const choice = (o: any = {}) => ({ via: '', mode: '', ref: '', linkKind: '', linkId: null as number | null, adopt: false, ...o });

describe('delivery editor helpers', () => {
  it('puts the time on the wall in a time box, not UTC', () => {
    expect(nowLocalInput(new Date(2026, 10, 9, 16, 5))).toBe('2026-11-09T16:05');           // 9 Nov 2026, 4:05 pm on this machine's own clock
    expect(nowLocalInput(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03T00:00');
  });

  it('shows a stored time as it was typed', () => {
    expect(wallClock('2026-11-09T16:30:00.000Z')).toBe('2026-11-09T16:30');
    expect(wallClock('2026-11-09 16:30:00')).toBe('2026-11-09T16:30');
    expect(wallClock(null)).toBe('');
    expect(wallClock('')).toBe('');
  });

  it('says who delivers from the method', () => {
    expect(deliveredByKind({ deliverymethod: 'Courier' })).toBe('courier');
    expect(deliveredByKind({ deliverymethod: 'Staff Delivery' })).toBe('staff');
    expect(deliveredByKind({})).toBe('staff');
  });

  it('puts the receiver in one line, leaving out what is missing', () => {
    expect(receiverSummary({ receivername: 'Priya', receiverphone: '98765', receiveraddress: '12 Lake Rd' })).toBe('Priya, 98765, 12 Lake Rd');
    expect(receiverSummary({ receivername: ' Priya ', receiverphone: '', receiveraddress: undefined })).toBe('Priya');
    expect(receiverSummary({})).toBe('');
  });

  it('sends nothing when no way was chosen, so the cost is left as it is', () => {
    expect(buildCostPaid(choice())).toBeUndefined();
    expect(buildCostPaid(choice({ via: 'LINK' }))).toBeUndefined();                          // nothing to link yet
  });

  it('sends the way with what it needs', () => {
    expect(buildCostPaid(choice({ via: 'CASH' }))).toEqual({ via: 'CASH' });
    expect(buildCostPaid(choice({ via: 'CASH', shiftId: 7 }))).toEqual({ via: 'CASH', shiftid: 7 });      // a Store Head paying from another drawer
    expect(buildCostPaid(choice({ via: 'UNPAID', shiftId: 7 }))).toEqual({ via: 'UNPAID' });
    expect(buildCostPaid(choice({ via: 'UNPAID' }))).toEqual({ via: 'UNPAID' });
    expect(buildCostPaid(choice({ via: 'NONE' }))).toEqual({ via: 'NONE' });
    expect(buildCostPaid(choice({ via: 'DIGITAL', mode: 'UPI', ref: ' 123 ' }))).toEqual({ via: 'DIGITAL', mode: 'UPI', ref: '123' });
    expect(buildCostPaid(choice({ via: 'DIGITAL', mode: 'BANK' }))).toEqual({ via: 'DIGITAL', mode: 'BANK', ref: undefined });
    expect(buildCostPaid(choice({ via: 'LINK', linkKind: 'CASH', linkId: 12, adopt: true }))).toEqual({ link: { kind: 'CASH', id: 12 }, adopt: true });
  });

  it('says what is missing before the cost can be saved', () => {
    expect(costProblem(choice(), 0)).toBe('');                                                // nothing chosen: nothing to check
    expect(costProblem(choice({ via: 'CASH' }), 0)).toMatch(/Enter the cost/);
    expect(costProblem(choice({ via: 'CASH' }), 60)).toBe('');
    expect(costProblem(choice({ via: 'DIGITAL', mode: '' }), 60)).toMatch(/UPI, bank transfer/);
    expect(costProblem(choice({ via: 'DIGITAL', mode: 'UPI' }), 60)).toBe('');
    expect(costProblem(choice({ via: 'LINK' }), 60)).toMatch(/Choose the entry/);
    expect(costProblem(choice({ via: 'UNPAID' }), 0)).toBe('');
  });

  it('shows the way a delivery was already paid, and a linked one as linked', () => {
    expect(choiceOf({ costpaidvia: 'CASH' })).toBe('CASH');
    expect(choiceOf({ costpaidvia: 'CASH', costlinked: true })).toBe('LINK');
    expect(choiceOf({})).toBe('');
    expect(['CASH', 'DIGITAL', 'UNPAID', 'NONE', '', undefined].map((v) => costLabel(v))).toEqual(['Paid in cash', 'Paid digitally', 'Cost unpaid', 'No cost', '', '']);
  });
});
