import { maySkipMfa, parseTrustMode } from './device-trust';

describe('device trust', () => {
  it('defaults to counter and ignores nonsense', () => {
    expect(parseTrustMode(undefined)).toBe('counter');
    expect(parseTrustMode('whatever')).toBe('counter');
    expect(parseTrustMode('ALL')).toBe('all');
    expect(parseTrustMode('off')).toBe('off');
  });
  it('off trusts nobody', () => {
    expect(maySkipMfa('off', 'Counter')).toBe(false);
  });
  it('counter mode trusts Counter logins only', () => {
    expect(maySkipMfa('counter', 'Counter')).toBe(true);
    expect(maySkipMfa('counter', 'Sales Staff')).toBe(false);
    expect(maySkipMfa('counter', 'Store Head')).toBe(false);
  });
  it('all mode trusts everyone but owners and the platform admin', () => {
    expect(maySkipMfa('all', 'Sales Staff')).toBe(true);
    expect(maySkipMfa('all', 'Store Head')).toBe(true);
    expect(maySkipMfa('all', 'Business Head')).toBe(false);
    expect(maySkipMfa('all', 'Owner-operator')).toBe(false);
    expect(maySkipMfa('all', 'Site Admin')).toBe(false);
    expect(maySkipMfa('all', undefined)).toBe(false);
  });
});
