/** A name as people write it: capitals or all lower case become Title Case; a name already in mixed case is left alone. */
export function properName(word: string): string {
    const w = (word || '').trim();
    const noLower = !/[a-z]/.test(w) && /[A-Z]/.test(w);
    const noUpper = !/[A-Z]/.test(w) && /[a-z]/.test(w);
    return noLower || noUpper ? w.toLowerCase().replace(/(^|[^A-Za-z0-9])([a-z])/g, (_m, p, c) => p + c.toUpperCase()) : w;
}

/** How a message addresses the customer: "Madubalan Sir/Madam" (gender is never guessed from a name), or just "Sir/Madam" with no usable name. Same rule as the server's. */
export function greetingName(name: string | null | undefined): string {
    const first = String(name || '').trim().split(/\s+/).filter(w => w && !/^(mr|mrs|ms|dr|shri|smt)\.?$/i.test(w))[0];
    return first ? `${properName(first)} Sir/Madam` : 'Sir/Madam';
}
