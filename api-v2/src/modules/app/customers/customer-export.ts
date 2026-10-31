/** The most customers one download may hold. */
export const EXPORT_MAX = 2000;

/**
 * One CSV cell. Quotes are doubled, and a cell that begins with = + - @ (or a tab or return) is prefixed with an apostrophe so a spreadsheet
 * never runs it as a formula: customer names and notes are typed by people, and a list is opened in Excel.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** the customer's first name for a message: titles dropped, "there" when there is nothing to use */
export function firstName(name: string | null | undefined): string {
  const word = String(name || '').trim().split(/\s+/).filter((w) => w && !/^(mr|mrs|ms|dr|shri|smt)\.?$/i.test(w))[0];
  return word || 'there';
}

/** A name as people write it: capitals or all lower case become Title Case ("MADUBALAN" -> "Madubalan"); a name already in mixed case is left alone. */
export function properName(word: string): string {
  const w = word.trim();
  if (!w) return w;
  const noLower = !/[a-z]/.test(w) && /[A-Z]/.test(w);
  const noUpper = !/[A-Z]/.test(w) && /[a-z]/.test(w);
  return noLower || noUpper ? w.toLowerCase().replace(/(^|[^A-Za-z0-9])([a-z])/g, (_m, p, c) => p + c.toUpperCase()) : w;
}

/**
 * How a message addresses the customer, for the {name} in "Hello {name},": the first name in proper case followed by "Sir/Madam"
 * ("Hello Madubalan Sir/Madam,"). Gender is never guessed from a name. With no usable name it is just "Sir/Madam".
 */
export function greetingName(name: string | null | undefined): string {
  const first = firstName(name);
  return first === 'there' ? 'Sir/Madam' : `${properName(first)} Sir/Madam`;
}

export interface ExportMember { name: string | null; mobile: string | null; segment: string; tier: string | null; reason: string; spend12: number; }

/**
 * The download: a header, a row per customer, and a closing line that says who took it and when, so a copy that turns up elsewhere can be
 * traced. The rows are the customers who can be contacted, best spenders first, at most EXPORT_MAX.
 */
export function buildAudienceCsv(members: ExportMember[], message: string, by: string, when: string): { csv: string; count: number } {
  const rows = members.slice(0, EXPORT_MAX);
  const lines = [['Name', 'Mobile', 'Segment', 'Tier', 'Why', 'Spend (12 mo)', 'Message'].map(csvCell).join(',')];
  for (const m of rows) {
    lines.push([m.name, m.mobile, m.segment, m.tier, m.reason, m.spend12, message.replace(/\{name\}/g, greetingName(m.name))].map(csvCell).join(','));
  }
  lines.push('');
  lines.push(csvCell(`Customer list taken by ${by} on ${when}. Confidential: for contacting customers only.`));
  return { csv: lines.join('\r\n'), count: rows.length };
}
