import { creditsEditable, netAfterCredits, returnLineProblem, returnLineValue, returnValue } from './vendor-return-rule';

describe('vendor returns', () => {
  it('values a line with its GST', () => expect(returnLineValue({ qty: 10, rate: 20, taxpcnt: 12 })).toEqual({ taxable: 200, tax: 24, total: 224 }));
  it('adds up lines', () => expect(returnValue([{ qty: 10, rate: 20, taxpcnt: 12 }, { qty: 5, rate: 10, taxpcnt: 5 }]).total).toBe(276.5));
  it('refuses more than is in stock', () => expect(returnLineProblem({ qty: 11, rate: 5 }, 10, 'Dolo')).toMatch(/only 10/));
  it('refuses nothing or a fraction', () => { expect(returnLineProblem({ qty: 0, rate: 5 }, 10, 'X')).toMatch(/how many/); expect(returnLineProblem({ qty: 1.5, rate: 5 }, 10, 'X')).toMatch(/how many/); });
  it('accepts a good line', () => expect(returnLineProblem({ qty: 10, rate: 5 }, 10, 'X')).toBe(''));
  it('takes credits off the invoice', () => expect(netAfterCredits(3000, 500)).toEqual({ net: 2500, problem: '' }));
  it('blocks a credit bigger than the purchase', () => expect(netAfterCredits(300, 500).problem).toMatch(/more than the goods/));
  it('allows an exact wipe-out', () => expect(netAfterCredits(500, 500).problem).toBe(''));
  it('lets credits be adjusted on a draft, paid or not', () => expect(creditsEditable('NEW', 0).editable).toBe(true));
  it('lets credits be adjusted on a completed invoice with nothing paid', () => expect(creditsEditable('COMPLETE', 0)).toEqual({ editable: true, reason: '' }));
  it('treats a payment that was reversed (nets to nothing) as unpaid', () => expect(creditsEditable('COMPLETE', 0.001).editable).toBe(true));
  it('refuses once a payment is recorded', () => expect(creditsEditable('COMPLETE', 500)).toMatchObject({ editable: false, reason: expect.stringMatching(/payment has been recorded/) }));
  it('refuses any other status', () => expect(creditsEditable('CANCELLED', 0).editable).toBe(false));
});
