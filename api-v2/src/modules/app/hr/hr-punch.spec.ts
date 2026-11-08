import { datesBetween, decodePhoto, generatePin, isValidPin, lockMinutesLeft, nextKind, punchFlags } from './hr-punch';

describe('PIN', () => {
  it('is 4 to 6 digits', () => {
    expect(isValidPin('4821')).toBe(true);
    expect(isValidPin('482193')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin(undefined)).toBe(false);
  });
  it('is generated as 4 digits that are not an obvious run', () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePin();
      expect(p).toMatch(/^\d{4}$/);
      expect(p).not.toMatch(/^(\d)\1{3}$/);
      expect(['1234', '4321', '0123', '3210']).not.toContain(p);
    }
  });
  it('locks out for the minutes left', () => {
    const now = new Date('2026-11-08T10:00:00Z');
    expect(lockMinutesLeft(null, now)).toBe(0);
    expect(lockMinutesLeft('2026-11-08T09:59:00Z', now)).toBe(0);
    expect(lockMinutesLeft('2026-11-08T10:07:30Z', now)).toBe(8);
  });
});

describe('what a punch is', () => {
  it('is In first, then Out, then nothing more that day', () => {
    expect(nextKind(null)).toBe('IN');
    expect(nextKind('IN')).toBe('OUT');
    expect(nextKind('OUT')).toBeNull();
  });
  it('is late after the shift start plus the grace', () => {
    expect(punchFlags('IN', '09:10', '09:00', '18:00', 10)).toEqual([]);
    expect(punchFlags('IN', '09:11', '09:00', '18:00', 10)).toEqual(['LATE']);
    expect(punchFlags('IN', '14:00', null, null, 10)).toEqual([]);
  });
  it('is an early out before the shift end less the grace', () => {
    expect(punchFlags('OUT', '17:50', '09:00', '18:00', 10)).toEqual([]);
    expect(punchFlags('OUT', '17:49', '09:00', '18:00', 10)).toEqual(['EARLY_OUT']);
    expect(punchFlags('OUT', '19:00', '09:00', '18:00', 10)).toEqual([]);
  });
});

describe('the photo', () => {
  const jpeg = (n: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n)]).toString('base64');
  it('accepts a JPEG data URL or plain base64', () => {
    expect(decodePhoto('data:image/jpeg;base64,' + jpeg(5000)).ok).toBe(true);
    expect(decodePhoto(jpeg(5000)).ok).toBe(true);
  });
  it('refuses nothing, a tiny picture, a huge one and something that is not a JPEG', () => {
    expect(decodePhoto('').ok).toBe(false);
    expect(decodePhoto(undefined).ok).toBe(false);
    expect(decodePhoto(jpeg(100)).ok).toBe(false);
    expect(decodePhoto(jpeg(500_000)).ok).toBe(false);
    expect(decodePhoto(Buffer.alloc(5000).toString('base64')).ok).toBe(false);
    expect(decodePhoto('not base64 !!').ok).toBe(false);
  });
});

describe('dates', () => {
  it('lists each day, both ends included', () => {
    expect(datesBetween('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(datesBetween('2026-03-02', '2026-03-01')).toEqual([]);
  });
});
