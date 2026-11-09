import * as fs from 'fs';
import * as path from 'path';
import { COST_VIA, CostRequest, CostState, DIGITAL_MODES, LINKED_MESSAGE, LOCKED_CASH, LOCKED_DIGITAL, cleanCostRequest, costDescription, costLabel, planCost } from './delivery-cost-rules';

const none: CostState = { via: null, amount: null, mode: null, cashEntryId: null, expenseId: null, cashEditable: false, expenseEditable: false, linked: false };
const cash = (o: Partial<CostState> = {}): CostState => ({ ...none, via: 'CASH', amount: 60, cashEntryId: 7, cashEditable: true, ...o });
const digital = (o: Partial<CostState> = {}): CostState => ({ ...none, via: 'DIGITAL', amount: 60, mode: 'UPI', expenseId: 9, expenseEditable: true, ...o });
const req = (o: Partial<CostRequest> = {}): CostRequest => ({ via: 'CASH', mode: null, ref: null, amount: 60, link: null, ...o });

describe('delivery cost rules', () => {
  it('checks what the screen sent', () => {
    expect(cleanCostRequest(undefined, 60)).toEqual({ ok: true, req: null });                         // the cost is not being touched
    expect(cleanCostRequest({}, 60)).toEqual({ ok: true, req: null });
    expect(cleanCostRequest({ via: 'cash' }, 60)).toEqual({ ok: true, req: { via: 'CASH', mode: null, ref: null, amount: 60, link: null } });
    expect(cleanCostRequest({ via: 'UNPAID' }, 60)).toEqual({ ok: true, req: { via: 'UNPAID', mode: null, ref: null, amount: 60, link: null } });
    expect(cleanCostRequest({ via: 'NONE' }, 60)).toEqual({ ok: true, req: { via: 'NONE', mode: null, ref: null, amount: 0, link: null } });   // no cost is no amount
    expect(cleanCostRequest({ via: 'DIGITAL', mode: 'upi', ref: ' 123 ABC ' }, 60)).toEqual({ ok: true, req: { via: 'DIGITAL', mode: 'UPI', ref: '123 ABC', amount: 60, link: null } });
  });

  it('refuses what cannot be right', () => {
    const bad = (raw: any, amount: any) => (cleanCostRequest(raw, amount) as any).message as string;
    expect(bad({ via: 'cheque-ish' }, 60)).toMatch(/Choose how/);
    expect(bad({ via: 'CASH' }, 0)).toMatch(/Enter the cost/);
    expect(bad({ via: 'DIGITAL', mode: 'UPI' }, null)).toMatch(/Enter the cost/);
    expect(bad({ via: 'DIGITAL' }, 60)).toMatch(/UPI, bank transfer, card or cheque/);
    expect(bad({ via: 'DIGITAL', mode: 'CASH' }, 60)).toMatch(/UPI, bank transfer, card or cheque/);   // cash is its own choice
    expect(bad({ via: 'CASH' }, -5)).toMatch(/negative/);
    expect(bad({ via: 'CASH' }, 5000000)).toMatch(/too large/);
    expect(COST_VIA).toEqual(['CASH', 'DIGITAL', 'UNPAID', 'NONE']);
    expect(DIGITAL_MODES).toEqual(['UPI', 'BANK', 'CARD', 'CHEQUE']);
  });

  it('with nothing sent, nothing is done', () => {
    expect(planCost(cash(), null)).toEqual([{ do: 'none' }]);
  });

  it('a first payment is posted once, and the same request again does nothing', () => {
    expect(planCost(none, req())).toEqual([{ do: 'post', via: 'CASH' }]);
    expect(planCost(cash(), req())).toEqual([{ do: 'none' }]);
    expect(planCost(digital(), req({ via: 'DIGITAL', mode: 'UPI' }))).toEqual([{ do: 'none' }]);
  });

  it('a changed amount or mode updates the entry while it can still change, and is refused after', () => {
    expect(planCost(cash(), req({ amount: 80 }))).toEqual([{ do: 'update', via: 'CASH' }]);
    expect(planCost(cash({ cashEditable: false }), req({ amount: 80 }))).toEqual([{ do: 'refuse', message: LOCKED_CASH }]);
    expect(planCost(digital(), req({ via: 'DIGITAL', mode: 'BANK' }))).toEqual([{ do: 'update', via: 'DIGITAL' }]);
    expect(planCost(digital({ expenseEditable: false }), req({ via: 'DIGITAL', mode: 'UPI', amount: 70 }))).toEqual([{ do: 'refuse', message: LOCKED_DIGITAL }]);
  });

  it('switching how it was paid takes the old entry back first, when it can be', () => {
    expect(planCost(cash(), req({ via: 'DIGITAL', mode: 'UPI' }))).toEqual([{ do: 'reverse', kind: 'CASH', unlinkOnly: false }, { do: 'post', via: 'DIGITAL' }]);
    expect(planCost(digital(), req({ via: 'CASH' }))).toEqual([{ do: 'reverse', kind: 'DIGITAL', unlinkOnly: false }, { do: 'post', via: 'CASH' }]);
    expect(planCost(cash({ cashEditable: false }), req({ via: 'DIGITAL', mode: 'UPI' }))).toEqual([{ do: 'refuse', message: LOCKED_CASH }]);
    expect(planCost(digital({ expenseEditable: false }), req({ via: 'CASH' }))).toEqual([{ do: 'refuse', message: LOCKED_DIGITAL }]);
  });

  it('not paid yet or no cost takes back what was posted, and posts nothing', () => {
    expect(planCost(none, req({ via: 'UNPAID' }))).toEqual([{ do: 'none' }]);
    expect(planCost(none, req({ via: 'NONE', amount: 0 }))).toEqual([{ do: 'none' }]);
    expect(planCost(cash(), req({ via: 'UNPAID' }))).toEqual([{ do: 'reverse', kind: 'CASH', unlinkOnly: false }]);
    expect(planCost(digital(), req({ via: 'NONE', amount: 0 }))).toEqual([{ do: 'reverse', kind: 'DIGITAL', unlinkOnly: false }]);
    expect(planCost(cash({ cashEditable: false }), req({ via: 'UNPAID' }))).toEqual([{ do: 'refuse', message: LOCKED_CASH }]);
  });

  it('links an entry that was already there, instead of posting a new one', () => {
    const asked = cleanCostRequest({ link: { kind: 'cash', id: 12 } }, 60);
    expect(asked).toEqual({ ok: true, req: { via: 'CASH', mode: null, ref: null, amount: 60, link: { kind: 'CASH', id: 12 } } });
    expect((cleanCostRequest({ link: { kind: 'bank', id: 1 } }, 60) as any).message).toMatch(/cash entry or an expense/);
    expect((cleanCostRequest({ link: { kind: 'CASH', id: 0 } }, 60) as any).message).toMatch(/Choose the entry/);
    expect(cleanCostRequest({ link: { kind: 'DIGITAL', id: 3 } }, 0)).toMatchObject({ ok: true });         // the entry's own amount counts, so none is needed
    const link = req({ via: 'CASH', link: { kind: 'CASH', id: 12 } });
    expect(planCost(none, link)).toEqual([{ do: 'link', kind: 'CASH', id: 12 }]);
    expect(planCost(cash({ cashEntryId: 12, linked: true }), link)).toEqual([{ do: 'none' }]);              // the same entry again
    // a different one replaces it: a linked entry is only let go, one the delivery posted is taken back
    expect(planCost(cash({ cashEntryId: 7, linked: true }), link)).toEqual([{ do: 'reverse', kind: 'CASH', unlinkOnly: true }, { do: 'link', kind: 'CASH', id: 12 }]);
    expect(planCost(cash(), link)).toEqual([{ do: 'reverse', kind: 'CASH', unlinkOnly: false }, { do: 'link', kind: 'CASH', id: 12 }]);
    expect(planCost(cash({ cashEditable: false }), link)).toEqual([{ do: 'refuse', message: LOCKED_CASH }]);   // a posted entry in a closed shift cannot be taken back
  });

  it('a linked entry is never changed or deleted from the delivery, only let go', () => {
    const linkedCash = cash({ cashEntryId: 12, linked: true, cashEditable: false });                      // its shift is long closed
    expect(planCost(linkedCash, req({ amount: 80 }))).toEqual([{ do: 'refuse', message: LINKED_MESSAGE }]);
    expect(planCost(linkedCash, req())).toEqual([{ do: 'none' }]);
    expect(planCost(linkedCash, req({ via: 'UNPAID' }))).toEqual([{ do: 'reverse', kind: 'CASH', unlinkOnly: true }]);   // letting go works even when the shift is closed
    expect(planCost(digital({ linked: true, expenseEditable: false }), req({ via: 'NONE', amount: 0 }))).toEqual([{ do: 'reverse', kind: 'DIGITAL', unlinkOnly: true }]);
    expect(planCost(linkedCash, req({ via: 'DIGITAL', mode: 'UPI' }))).toEqual([{ do: 'reverse', kind: 'CASH', unlinkOnly: true }, { do: 'post', via: 'DIGITAL' }]);
  });

  it('describes the entry, and labels the list', () => {
    expect(costDescription(1234, 'Priya', 'Ramesh')).toBe('Delivery #1234 to Priya by Ramesh');
    expect(costDescription(1234, null, ' ')).toBe('Delivery #1234');
    expect(costDescription(null, 'A', 'B')).toBe('Delivery #? to A by B');
    expect(costDescription(1, 'x'.repeat(400), null).length).toBe(200);
    expect(['CASH', 'DIGITAL', 'UNPAID', 'NONE', null].map(costLabel)).toEqual(['Paid in cash', 'Paid digitally', 'Cost unpaid', 'No cost', '']);
  });

  it('the migration allows exactly the ways and modes the code uses', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../../../../sql/migrations/179_delivery_cost.sql'), 'utf8');
    const list = (name: string) => [...sql.match(new RegExp(`${name} CHECK \\([^)]*IN \\(([^)]*)\\)`))![1].matchAll(/'([A-Z]+)'/g)].map((m) => m[1]);
    expect(list('sale_deliveries_cost_via_chk').sort()).toEqual([...COST_VIA].sort());
    expect(list('sale_deliveries_cost_mode_chk').sort()).toEqual([...DIGITAL_MODES].sort());
  });
});
