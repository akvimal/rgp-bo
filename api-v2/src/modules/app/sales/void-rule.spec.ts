import { voidProblem, voidReasonProblem } from './void-rule';

const ok = { status: 'COMPLETE', shiftId: 4, shiftStatus: 'OPEN', returns: 0, isOwn: true, canVoidAny: false };

describe('voiding a bill', () => {
  it('is allowed for your own completed bill in the open shift', () => expect(voidProblem(ok)).toBeNull());
  it('is allowed for a manager on someone else\'s bill', () => expect(voidProblem({ ...ok, isOwn: false, canVoidAny: true })).toBeNull());
  it('is refused for someone else\'s bill without the right', () => expect(voidProblem({ ...ok, isOwn: false })).toContain('only the bills you rang up'));
  it('is refused once the shift is closed', () => expect(voidProblem({ ...ok, shiftStatus: 'CLOSED' })).toContain('shift is closed'));
  it('is refused for a bill with no shift', () => expect(voidProblem({ ...ok, shiftId: null, shiftStatus: null })).toContain('not on a shift'));
  it('is refused when something was returned', () => expect(voidProblem({ ...ok, returns: 1 })).toContain('returned'));
  it('is refused for a held or an already voided bill', () => {
    expect(voidProblem({ ...ok, status: 'PENDING' })).toContain('discarded');
    expect(voidProblem({ ...ok, status: 'VOID' })).toContain('already voided');
  });
  it('a force-void ignores the shift and who rang the bill, but not returns or status', () => {
    const f = { ...ok, force: true, isOwn: false, shiftStatus: 'CLOSED' };
    expect(voidProblem(f)).toBeNull();
    expect(voidProblem({ ...f, shiftId: null, shiftStatus: null })).toBeNull();
    expect(voidProblem({ ...f, returns: 1 })).toContain('returned');
    expect(voidProblem({ ...f, status: 'VOID' })).toContain('already voided');
    expect(voidProblem({ ...f, status: 'PENDING' })).toContain('discarded');
  });
  it('needs a reason', () => {
    expect(voidReasonProblem('  ')).not.toBeNull();
    expect(voidReasonProblem('ab')).not.toBeNull();
    expect(voidReasonProblem('rung up twice')).toBeNull();
  });
});
