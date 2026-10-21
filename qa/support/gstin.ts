/**
 * GSTIN generator for tests. The API checks the format, the state code and the last (check) character, so test
 * data has to carry a correct check character. Real GSTINs are never used here.
 */
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** the check character for the first 14 characters */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

/** a complete valid GSTIN from its first 14 characters, e.g. withCheck('29ABCDE1234F1Z') */
export function withCheck(first14: string): string {
  return first14 + gstinCheckChar(first14);
}

const STATES = ['33', '27', '29', '07', '24', '32', '36', '19'];
const rnd = (n: number) => Math.floor(Math.random() * n);
const letter = () => String.fromCharCode(65 + rnd(26));
const digit = () => String(rnd(10));

/** a random valid GSTIN; pass a state code to pin the state */
export function randomGstin(state?: string): string {
  const st = state ?? STATES[rnd(STATES.length)];
  const pan = Array.from({ length: 5 }, letter).join('') + Array.from({ length: 4 }, digit).join('') + letter();
  return withCheck(`${st}${pan}1Z`);
}

/** the same GSTIN with a wrong check character */
export function breakCheck(g: string): string {
  return g.slice(0, 14) + (g[14] === 'A' ? 'B' : 'A');
}
