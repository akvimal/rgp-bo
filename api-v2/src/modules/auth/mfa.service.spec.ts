import { JwtService } from '@nestjs/jwt';
import { MfaService, mfaMode } from './mfa.service';

// RFC 6238 appendix B: the secret "12345678901234567890" (base32 below); at 59 seconds the code is 94287082, so 287082 with 6 digits
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('MfaService', () => {
  let mfa: MfaService;
  const jwt = new JwtService({ secret: 'test-key' });

  beforeEach(() => {
    process.env.JWT_KEY = 'test-key';
    mfa = new MfaService(jwt, { record: jest.fn() } as any, {} as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('accepts the RFC 6238 code for its time, and tells which 30-second step it belongs to', () => {
    jest.spyOn(Date, 'now').mockReturnValue(59_000);
    expect(mfa.matchedStep(RFC_SECRET, '287082')).toBe(1);
    expect(mfa.matchedStep(RFC_SECRET, '287 082')).toBe(1);        // spaces typed by the person
  });

  it('forgives a phone clock one step out, but not three', () => {
    jest.spyOn(Date, 'now').mockReturnValue(59_000 + 30_000);       // the app is one step behind the server
    expect(mfa.matchedStep(RFC_SECRET, '287082')).toBe(1);
    jest.spyOn(Date, 'now').mockReturnValue(59_000 + 90_000);
    expect(mfa.matchedStep(RFC_SECRET, '287082')).toBeNull();
  });

  it('rejects wrong or malformed codes', () => {
    jest.spyOn(Date, 'now').mockReturnValue(59_000);
    expect(mfa.matchedStep(RFC_SECRET, '000000')).toBeNull();
    expect(mfa.matchedStep(RFC_SECRET, '28708')).toBeNull();
    expect(mfa.matchedStep(RFC_SECRET, 'abcdef')).toBeNull();
    expect(mfa.matchedStep(RFC_SECRET, '')).toBeNull();
  });

  it('keeps the secret encrypted, and reads it back', () => {
    const stored = mfa.encrypt(RFC_SECRET);
    expect(stored).not.toContain(RFC_SECRET);
    expect(mfa.decrypt(stored)).toBe(RFC_SECRET);
    expect(mfa.encrypt(RFC_SECRET)).not.toBe(stored);               // a fresh random IV each time
    expect(() => mfa.decrypt(stored.replace(/.$/, 'A') + 'x')).toThrow();
  });

  it('a step token is for its own step only, and is not a sign-in token', async () => {
    const token = await mfa.signStepToken(7, 'verify');
    await expect(mfa.readStepToken(token, 'verify')).resolves.toBe(7);
    await expect(mfa.readStepToken(token, 'enrol')).rejects.toThrow();
    // the ordinary token key (the auth guard's) does not open it
    await expect(jwt.verifyAsync(token, { secret: process.env.JWT_KEY })).rejects.toThrow();
    await expect(mfa.readStepToken('junk', 'verify')).rejects.toThrow();
  });

  it('MFA is required unless the environment says otherwise', () => {
    delete process.env.MFA_MODE;
    expect(mfaMode()).toBe('required');
    process.env.MFA_MODE = 'off';
    expect(mfaMode()).toBe('off');
    process.env.MFA_MODE = 'Optional';
    expect(mfaMode()).toBe('optional');
    process.env.MFA_MODE = 'nonsense';
    expect(mfaMode()).toBe('required');
    delete process.env.MFA_MODE;
  });
});
