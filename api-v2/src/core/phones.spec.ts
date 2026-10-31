import { checkPhones } from './phones';

describe('checkPhones', () => {
  it('keeps one number, and nothing for an empty box', () => {
    expect(checkPhones('044 2345 6789')).toEqual({ ok: true, value: '044 2345 6789' });
    expect(checkPhones('  ')).toEqual({ ok: true, value: null });
    expect(checkPhones(undefined)).toEqual({ ok: true, value: null });
  });

  it('tidies several numbers separated by commas, slashes or semicolons', () => {
    expect(checkPhones('98400 12345,  044-23456789 / 98400 54321')).toEqual({ ok: true, value: '98400 12345, 044-23456789, 98400 54321' });
  });

  it('refuses letters, a number that is too short, too many numbers, and too many characters', () => {
    expect(checkPhones('call me').ok).toBe(false);
    expect(checkPhones('12345').ok).toBe(false);
    expect(checkPhones('9840012345, 9840012346, 9840012347, 9840012348, 9840012349').ok).toBe(false);
    expect(checkPhones('+91 98400 12345, +91 98400 12346, +91 98400 12347, +91 98400 12348').ok).toBe(false);
  });
});
