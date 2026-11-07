import { needsApproval } from './invoice-approval';

describe('needsApproval', () => {
  const on = { enabled: true, limit: 0 };
  it('is never needed while the setting is off', () => {
    expect(needsApproval({ enabled: false, limit: 0 }, 50000, null)).toBe(false);
  });
  it('is needed for every invoice when the limit is 0', () => {
    expect(needsApproval(on, 10, null)).toBe(true);
  });
  it('is not needed once approved', () => {
    expect(needsApproval(on, 5000, new Date())).toBe(false);
  });
  it('is not needed up to the limit, and needed above it', () => {
    const p = { enabled: true, limit: 5000 };
    expect(needsApproval(p, 5000, null)).toBe(false);
    expect(needsApproval(p, '5000.01', null)).toBe(true);
    expect(needsApproval(p, 1200, null)).toBe(false);
  });
});
