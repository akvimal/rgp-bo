import { checkEngagement, ownerDefault, relationshipsFor } from './hr-engagement';

describe('who may be an owner or a director', () => {
  it('a proprietorship, partnership, LLP or other form offers owner or partner; a limited company offers director', () => {
    for (const f of ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'OTHER', null, undefined]) expect(relationshipsFor(f as any)).toEqual(['EMPLOYEE', 'OWNER']);
    for (const f of ['PRIVATE_LIMITED', 'PUBLIC_LIMITED']) expect(relationshipsFor(f)).toEqual(['EMPLOYEE', 'DIRECTOR']);
  });
  it('the person setting up starts as owner, or as director in a limited company', () => {
    expect(ownerDefault('PROPRIETORSHIP')).toBe('OWNER');
    expect(ownerDefault('PRIVATE_LIMITED')).toBe('DIRECTOR');
  });
});

describe('the relationship and the payroll switch', () => {
  it('nothing given is an employee on payroll, whatever the form', () => {
    expect(checkEngagement('PROPRIETORSHIP', undefined, undefined)).toEqual({ value: { relationship: 'EMPLOYEE', on_payroll: true } });
    expect(checkEngagement('PRIVATE_LIMITED', '', false)).toEqual({ value: { relationship: 'EMPLOYEE', on_payroll: true } });
  });
  it('an owner or partner is never on payroll, even when asked', () => {
    expect(checkEngagement('PROPRIETORSHIP', 'OWNER', true)).toEqual({ value: { relationship: 'OWNER', on_payroll: false } });
    expect(checkEngagement('PARTNERSHIP', 'OWNER', undefined)).toEqual({ value: { relationship: 'OWNER', on_payroll: false } });
  });
  it('a director is off payroll until the owner says they are salaried', () => {
    expect(checkEngagement('PRIVATE_LIMITED', 'DIRECTOR', undefined)).toEqual({ value: { relationship: 'DIRECTOR', on_payroll: false } });
    expect(checkEngagement('PRIVATE_LIMITED', 'DIRECTOR', true)).toEqual({ value: { relationship: 'DIRECTOR', on_payroll: true } });
    expect(checkEngagement('PUBLIC_LIMITED', 'DIRECTOR', 'yes')).toEqual({ value: { relationship: 'DIRECTOR', on_payroll: false } });
  });
  it('an owner in a limited company and a director anywhere else are refused, with what to choose instead', () => {
    expect(checkEngagement('PRIVATE_LIMITED', 'OWNER', false)).toEqual({ error: expect.stringContaining('director') });
    expect(checkEngagement('PROPRIETORSHIP', 'DIRECTOR', true)).toEqual({ error: expect.stringContaining('limited company') });
  });
  it('rejects anything that is not a relationship', () => {
    expect('error' in checkEngagement('LLP', 'BOSS', true)).toBe(true);
  });
});
