import { BadRequestException } from '@nestjs/common';

/** The walk-in record the billing screen uses when no number is given. It is a placeholder, not a real mobile. */
export const NIL_MOBILE = '0000000000';

/**
 * A customer's mobile as an Indian 10-digit number. Spaces, dashes, "+91", "91" and a leading 0 are stripped.
 * Blank gives null; anything that is not a real mobile (it must start 6-9) is refused. The NIL walk-in passes through.
 */
export function normaliseMobile(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits === NIL_MOBILE) return digits;
  if (!/^[6-9][0-9]{9}$/.test(digits)) {
    throw new BadRequestException('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');
  }
  return digits;
}

/** Collapses runs of spaces; blank gives null; refuses text longer than max. */
export function cleanText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  const t = String(value).trim().replace(/\s+/g, ' ');
  if (t.length > max) throw new BadRequestException(`${label} can be at most ${max} characters.`);
  return t || null;
}

export function cleanEmail(value: unknown): string | null {
  const t = cleanText(value, 120, 'The email');
  if (!t) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(t)) throw new BadRequestException('The email address is not valid.');
  return t.toLowerCase();
}

function letters(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z]/g, '');
}

function distance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Two names that probably belong to one person: equal, one a prefix of the other ("JOSHUA" / "JOSHUA JESUDASON"),
 * or a spelling slip ("THILLA GOVINDAN" / "THILLAI GOVINDAN"). Short names are not guessed at.
 */
export function likelySamePerson(a: string, b: string): boolean {
  const x = letters(a);
  const y = letters(b);
  if (x.length < 4 || y.length < 4) return false;
  if (x === y) return true;
  if (x.startsWith(y) || y.startsWith(x)) return true;
  return Math.min(x.length, y.length) >= 6 && distance(x, y) <= 2;
}
