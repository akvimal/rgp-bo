import { deliveryModeProblem, DeliveryModeFacts, needsReason } from './delivery-mode-rule';

const base: DeliveryModeFacts = { status: 'COMPLETE', currentType: 'Counter', target: 'Delivery', shiftId: 5, shiftStatus: 'OPEN', deliveryStatus: null, isOwn: true, isManager: false };

describe('changing a completed bill between counter and delivery', () => {
  it('lets the biller do it while their shift is open, with no reason needed', () => {
    expect(deliveryModeProblem(base)).toBeNull();
    expect(needsReason(base)).toBe(false);
  });
  it('refuses a held, voided or already-matching bill', () => {
    expect(deliveryModeProblem({ ...base, status: 'PENDING' })).toMatch(/completed bill/);
    expect(deliveryModeProblem({ ...base, status: 'VOID' })).toMatch(/voided/);
    expect(deliveryModeProblem({ ...base, currentType: 'Delivery' })).toMatch(/already a delivery/);
    expect(deliveryModeProblem({ ...base, currentType: 'Delivery', target: 'Counter', deliveryStatus: 'Pending' })).toBeNull();
    expect(deliveryModeProblem({ ...base, target: 'Counter' })).toMatch(/already a counter sale/);
  });
  it('treats a bill with no type as a counter sale', () => {
    expect(deliveryModeProblem({ ...base, currentType: null })).toBeNull();
  });
  it('stops someone else\'s bill, and a closed shift, for an ordinary login', () => {
    expect(deliveryModeProblem({ ...base, isOwn: false })).toMatch(/only the bills you rang/);
    expect(deliveryModeProblem({ ...base, shiftStatus: 'CLOSED' })).toMatch(/shift is closed/);
    expect(deliveryModeProblem({ ...base, shiftId: null })).toMatch(/shift is closed/);
  });
  it('lets a manager do it any time, with a reason', () => {
    const m = { ...base, isManager: true, isOwn: false, shiftStatus: 'CLOSED' };
    expect(deliveryModeProblem(m)).toMatch(/Say why/);
    expect(deliveryModeProblem({ ...m, reason: 'rider took it the next morning' })).toBeNull();
    expect(deliveryModeProblem({ ...m, reason: 'no' })).toMatch(/at least 5/);
  });
  it('refuses a delivery to another state, because the tax would change', () => {
    expect(deliveryModeProblem({ ...base, outsideState: true })).toMatch(/another state/);
    expect(deliveryModeProblem({ ...base, outsideState: true, target: 'Counter', currentType: 'Delivery' })).toBeNull();
  });
  it('will not turn a delivered bill back into a counter sale', () => {
    expect(deliveryModeProblem({ ...base, currentType: 'Delivery', target: 'Counter', deliveryStatus: 'Delivered' })).toMatch(/already marked as delivered/);
  });
});
