/**
 * The foot of the bill is a template the business writes. One renderer for the printed bill and the WhatsApp copy, so the two always match.
 *
 * Tokens: {store_name} {business_name} {store_phone} {business_phone} {grievance_phone} {website} {bill_no} {date}
 * Phone modifier: {store_phone|spaced} (98765 43210, the default) {store_phone|intl} (+91 98765 43210) {store_phone|plain} (9876543210)
 * Text: **bold**, _italic_. A line may start with [c] centre (the default), [l] left or [r] right.
 * A line whose tokens are all empty is dropped, so a store with no grievance number prints no "Grievances:" line.
 */
export interface FooterContext {
  store_name?: string | null; business_name?: string | null; store_phone?: string | null; business_phone?: string | null;
  grievance_phone?: string | null; website?: string | null; bill_no?: string | null; date?: string | null;
}
export interface FooterPart { text: string; bold?: boolean; italic?: boolean }
export interface FooterLine { align: 'c' | 'l' | 'r'; parts: FooterPart[] }

/** what a store prints until it writes its own */
export const DEFAULT_FOOTER = [
  'For refill and complaints call or WhatsApp: **{store_phone}**',
  'For grievances call or WhatsApp: **{grievance_phone}**',
  '{website}',
  '**Thank you for choosing us. Wishing you good health.**',
].join('\n');

export const FOOTER_TOKENS = ['store_name', 'business_name', 'store_phone', 'business_phone', 'grievance_phone', 'website', 'bill_no', 'date'];
const PHONE_TOKENS = ['store_phone', 'business_phone', 'grievance_phone'];

/** one number, or several separated by commas, slashes or semicolons, each laid out the same way */
export function formatPhones(value: string | null | undefined, mode: 'spaced' | 'intl' | 'plain' = 'spaced'): string {
  const parts = String(value ?? '').split(/[,;/|]+/).map((p) => p.trim()).filter(Boolean);
  const one = (p: string) => {
    let d = p.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0') && /^0[6-9]/.test(d)) d = d.slice(1);
    if (/^[6-9]\d{9}$/.test(d)) {
      if (mode === 'plain') return d;
      const spaced = `${d.slice(0, 5)} ${d.slice(5)}`;
      return mode === 'intl' ? `+91 ${spaced}` : spaced;
    }
    return p;                                                   // a landline with its code, or anything else: as it was typed
  };
  return parts.map(one).join(', ');
}

function substitute(line: string, ctx: FooterContext): { text: string; hadTokens: boolean; anyValue: boolean } {
  let hadTokens = false, anyValue = false;
  const text = line.replace(/\{([a-z_]+)(?:\|([a-z]+))?\}/g, (whole, name: string, mod: string | undefined) => {
    if (!FOOTER_TOKENS.includes(name)) return whole;           // not one of ours: left as written
    hadTokens = true;
    let v = String((ctx as any)[name] ?? '').trim();
    if (v && PHONE_TOKENS.includes(name)) v = formatPhones(v, mod === 'intl' ? 'intl' : mod === 'plain' ? 'plain' : 'spaced');
    if (v) anyValue = true;
    return v;
  });
  return { text, hadTokens, anyValue };
}

/** **bold** and _italic_ into parts; the markers never print */
function styled(text: string): FooterPart[] {
  const parts: FooterPart[] = [];
  const re = /\*\*(.+?)\*\*|(^|[\s(])_(.+?)_(?=$|[\s).,;:!?])/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index) });
      parts.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    } else {
      const lead = m[2] ?? '';
      if (m.index + lead.length > last) parts.push({ text: text.slice(last, m.index) + lead });
      else if (lead) parts.push({ text: lead });
      parts.push({ text: m[3], italic: true });
      last = m.index + m[0].length;
    }
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

export function renderFooter(template: string | null | undefined, ctx: FooterContext): FooterLine[] {
  const source = String(template ?? '').trim() ? String(template) : DEFAULT_FOOTER;
  const out: FooterLine[] = [];
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    let align: FooterLine['align'] = 'c';
    const mark = /^\[([clr])\]\s*/i.exec(line);
    if (mark) { align = mark[1].toLowerCase() as FooterLine['align']; line = line.slice(mark[0].length); }
    const s = substitute(line, ctx);
    if (s.hadTokens && !s.anyValue) continue;                   // every token on the line is empty: the line goes
    const text = s.text.trim();
    if (!text) continue;
    out.push({ align, parts: styled(text) });
  }
  return out;
}

/** the footer as plain text, for a check or a log */
export const footerText = (lines: FooterLine[]): string => lines.map((l) => l.parts.map((p) => p.text).join('')).join('\n');

/** a template as saved: lines kept (the usual field cleaner would join them), each trimmed, blank runs dropped; empty means "use the standard" */
export function cleanFooter(v: unknown, max = 1200): { ok: boolean; value: string | null; error?: string } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false, value: null, error: 'The foot of the bill must be text.' };
  const t = v.replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  if (t.length > max) return { ok: false, value: null, error: `The foot of the bill can be at most ${max} characters.` };
  return { ok: true, value: t || null };
}
