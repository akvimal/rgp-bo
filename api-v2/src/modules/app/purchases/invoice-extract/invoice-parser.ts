/**
 * Reads a vendor invoice from positioned words (the text layer of a PDF, or OCR output of a photo): the header (vendor GSTIN,
 * invoice number, date, printed total) and the item table. The table is found by its header row; each column is the span of
 * its header word, so the layout of any distributor's invoice works as long as it has a header row with words like Batch, Exp,
 * Qty, Rate. Nothing here knows about files or the database.
 */

export interface Word { t: string; x0: number; x1: number; y0: number; y1: number; page: number }
export interface TextLine { page: number; y: number; h: number; words: Word[]; text: string }

export interface ExtractedLine {
  description: string;
  hsn: string | null;
  batch: string | null;
  expdate: string | null;       // the 1st of the month printed, YYYY-MM-DD (as the app stores it)
  mrp: number | null;
  qty: number | null;
  free: number | null;
  rate: number | null;          // before tax
  disc: number | null;          // percent
  tax: number | null;           // percent (CGST + SGST added up)
  amount: number | null;        // qty x rate less discount, before tax (how the item form works it out)
  amountRead: number | null;    // the amount as printed
  warnings: string[];
}

export interface ExtractedHeader {
  invoiceno: string | null;
  invoicedate: string | null;
  duedate: string | null;
  suppliergstin: string | null;
  suppliername: string | null;
  printedtotal: number | null;
  goodsvalue: number | null;                                        // the value of the goods before an invoice-level discount, as printed
  cashdiscount: { pct: number | null; amount: number } | null;      // "Less CD 4.00 %  48.94"
}

export interface ParsedInvoice { header: ExtractedHeader; lines: ExtractedLine[]; warnings: string[]; tableFound: boolean }

// ---------------------------------------------------------------------------------------------------------- words to lines
export function toLines(words: Word[]): TextLine[] {
  // a photo's table borders come out as | _ = characters: drop them, and any stuck to the ends of a word
  const ws = words.map((w) => ({ ...w, t: String(w.t ?? '').replace(/^[|_=[\]{}\\]+|[|_=[\]{}\\]+$/g, '').trim() })).filter((w) => w.t !== '' && !/^[-—–~.]+$/.test(w.t));
  if (!ws.length) return [];
  const heights = ws.map((w) => w.y1 - w.y0).filter((h) => h > 0).sort((a, b) => a - b);
  const med = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
  const tol = Math.max(2.5, med * 0.55);
  const centre = (w: Word) => (w.y0 + w.y1) / 2;
  ws.sort((a, b) => a.page - b.page || centre(a) - centre(b) || a.x0 - b.x0);
  const lines: TextLine[] = [];
  let cur: Word[] = [];
  let curY = 0, curPage = -1;
  const flush = () => {
    if (!cur.length) return;
    cur.sort((a, b) => a.x0 - b.x0);
    lines.push({ page: cur[0].page, y: curY, h: med, words: cur, text: cur.map((w) => w.t).join(' ') });
    cur = [];
  };
  for (const w of ws) {
    const c = centre(w);
    if (!cur.length || w.page !== curPage || Math.abs(c - curY) > tol) {
      flush();
      curPage = w.page; curY = c;
    } else {
      curY = (curY * cur.length + c) / (cur.length + 1);
    }
    cur.push(w);
  }
  flush();
  return lines;
}

// ---------------------------------------------------------------------------------------------------------- small readers
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const round2 = (n: number) => Math.round(n * 100) / 100;

export function readNumber(s: any): number | null {
  const m = String(s ?? '').replace(/[,₹]|rs\.?/gi, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function allNumbers(s: any): number[] {
  return (String(s ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

/** a date as printed on an Indian invoice (day first), as YYYY-MM-DD */
export function readDate(s: string): string | null {
  const t = String(s ?? '').trim();
  let m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = +m[1], mo = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = t.match(/(\d{1,2})[\s\-,]+([A-Za-z]{3,9})[\s\-,.]+(\d{2,4})/);
  if (m && MONTHS[m[2].slice(0, 4).toLowerCase()] || (m && MONTHS[m[2].slice(0, 3).toLowerCase()])) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()];
    const y = m![3].length === 2 ? 2000 + +m![3] : +m![3];
    return `${y}-${pad(mo)}-${pad(+m![1])}`;
  }
  return null;
}

/** an expiry as printed (08/27, 8-2027, Aug-27, AUG 2027): the 1st of that month, which is how the app stores an expiry */
export function readExpiry(s: string): string | null {
  const exact = readExpiryExact(s);
  if (exact) return exact;
  // OCR slips in a date made of digits and a slash: O for 0, S for 5, l or I for 1
  const t = String(s ?? '').trim();
  if (/^[0-9OoSsIl|]{1,2}\s*[\/\-.]\s*[0-9OoSsIl|]{2,4}$/.test(t)) {
    return readExpiryExact(t.replace(/[Oo]/g, '0').replace(/[Ss]/g, '5').replace(/[Il|]/g, '1'));
  }
  return null;
}

function readExpiryExact(s: string): string | null {
  const t = String(s ?? '').trim();
  let mo = 0, y = 0;
  const slash7 = t.match(/^(0[1-9]|1[0-2])7(\d{2})$/);                                // OCR reads the "/" of 08/27 as a 7
  let m = slash7 ? [t, slash7[1], slash7[2]] as RegExpMatchArray : t.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{2}|\d{4})$/);
  if (m) { mo = +m[1]; y = m[2].length === 2 ? 2000 + +m[2] : +m[2]; }
  if (!mo) {
    m = t.match(/^([A-Za-z]{3,9})[\s\-\/.,]*(\d{2}|\d{4})$/);
    if (m) { mo = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()] || 0; y = m[2].length === 2 ? 2000 + +m[2] : +m[2]; }
  }
  if (!mo) {
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);                       // a whole date: keep its month
    if (m) { mo = +m[2]; y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
  }
  if (!mo || mo < 1 || mo > 12 || y < 2015 || y > 2060) return null;
  return `${y}-${pad(mo)}-01`;
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function isGstin(g: string): boolean {
  const v = String(g ?? '').trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = GSTIN_CHARS.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === v[14];
}

/** a GSTIN misread by OCR (a letter taken for a digit, one wrong character): the one correction that makes the check character agree */
export function repairGstin(token: string, known: string[] = []): string | null {
  const v = String(token ?? '').toUpperCase();
  if (v.length !== 15 || !/^\d{2}/.test(v)) return null;
  if (isGstin(v)) return v;
  const toDigit: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', S: '5', B: '8' };
  const toLetter: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B' };
  // the pattern: 2 digits, 5 letters, 4 digits, a letter, an alphanumeric, Z, a check character
  const fixed = v.split('').map((c, i) => (i < 2 || (i >= 7 && i <= 10) ? (toDigit[c] ?? c) : (i < 7 || i === 11 ? (toLetter[c] ?? c) : i === 13 && c !== 'Z' ? (c === '2' ? 'Z' : c) : c))).join('');
  if (isGstin(fixed)) return fixed;
  // one wrong character: the identifier part first; only when that gives nothing, the check character itself
  const tryAt = (from: number, to: number) => {
    const found = new Set<string>();
    for (let i = from; i <= to; i++) {
      for (const ch of GSTIN_CHARS) {
        if (ch === fixed[i]) continue;
        const cand = fixed.slice(0, i) + ch + fixed.slice(i + 1);
        if (isGstin(cand)) found.add(cand);
      }
    }
    return found;
  };
  const inner = tryAt(2, 13);
  // several corrections can look valid: a GSTIN the business already knows (a vendor's) settles it
  const knownHits = Array.from(inner).filter((c) => known.includes(c));
  if (knownHits.length === 1) return knownHits[0];
  if (inner.size === 1) return Array.from(inner)[0];
  if (inner.size > 1) return null;
  const check = tryAt(14, 14);
  return check.size === 1 ? Array.from(check)[0] : null;
}

// ---------------------------------------------------------------------------------------------------------- the header
const NOT_VALUE = /^(date|dt|no|number|dated|of|the|and|gstin|gst|to|from|bill|invoice)$/i;

function readHeader(lines: TextLine[], ownGstin?: string | null, known: string[] = []): ExtractedHeader {
  const h: ExtractedHeader = { invoiceno: null, invoicedate: null, duedate: null, suppliergstin: null, suppliername: null, printedtotal: null, goodsvalue: null, cashdiscount: null };
  const own = String(ownGstin || '').toUpperCase();

  // supplier: the first GSTIN that is not the buyer's own; its name is the largest-looking line above it
  for (const l of lines) {
    const hits = (l.text.toUpperCase().match(/\b\d{2}[A-Z0-9]{13}\b/g) || []).filter((g) => g !== own);
    const good = hits.map((g) => (isGstin(g) ? g : repairGstin(g, known))).find((g) => !!g && g !== own) || null;
    if (good) { h.suppliergstin = good; break; }
  }
  // the supplier's name: the signature line ("For X Pvt. Ltd.") when there is one, else the first readable line at the top
  let signed: string | null = null;
  for (const l of lines) {
    const m = l.text.match(/\bfor\s+([A-Za-z0-9][^\n]{3,80}?\b(?:ltd|limited|llp)\b\.?)/i);
    if (m) signed = m[1];
  }
  if (signed) h.suppliername = signed.replace(/\s+/g, ' ').trim().slice(0, 100);
  else {
    const first = lines.slice(0, 6).find((l) => /[A-Za-z]{3,}/.test(l.text) && !/invoice|gstin|tax|original|duplicate|page|cash|credit/i.test(l.text));
    if (first) h.suppliername = first.text.replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  for (const l of lines) {
    const t = l.text;
    if (!h.invoiceno) {
      const m = t.match(/(?:invoice|inv|bill|cash\s*memo)\s*(?:no|number|num|#)\.?\s*[:\-.]?\s*([A-Za-z0-9][A-Za-z0-9\/\-._]{1,29})/i);
      if (m && !NOT_VALUE.test(m[1])) h.invoiceno = m[1].replace(/[.\-_/]+$/, '').toUpperCase();
    }
    if (!h.invoicedate) {
      const re = /((?:invoice|inv|bill)?\s*)\bdate(?:d)?\b\s*[:\-.]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-,]+[A-Za-z]{3,9}[\s\-,.]+\d{2,4})/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const before = t.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
        if (/due|order|exp|mfg|po\b|p\.o|supply/.test(before) || /due|order/.test(m[1].toLowerCase())) continue;
        const d = readDate(m[2]);
        if (d) { h.invoicedate = d; break; }
      }
    }
    if (!h.duedate) {
      const m = t.match(/due\s*date\s*[:\-.]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-,]+[A-Za-z]{3,9}[\s\-,.]+\d{2,4})/i);
      if (m) h.duedate = readDate(m[1]);
    }
  }
  // fall back to any date near the top when the label is unusual
  if (!h.invoicedate) {
    for (const l of lines.slice(0, 25)) {
      if (/due|order|exp|mfg/i.test(l.text)) continue;
      const m = l.text.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
      const d = m && readDate(m[1]);
      if (d) { h.invoicedate = d; break; }
    }
  }

  // printed total: the most specific label wins; the last one on the page
  const labels: Array<[RegExp, number]> = [
    [/net\s*(?:amount|payable|value)/i, 6], [/amount\s*payable/i, 6], [/grand\s*total/i, 5], [/invoice\s*(?:value|total|amount|amt)\b/i, 5],
    [/bill\s*(?:value|amount)/i, 4], [/total\s*amount/i, 3],
  ];
  let best: { score: number; value: number } | null = null;
  lines.forEach((l, idx) => {
    for (const [re, score] of labels) {
      if (!re.test(l.text)) continue;
      const nums = allNumbers(l.text.replace(re, ' ')).filter((n) => n >= 1);
      if (!nums.length) continue;
      const v = nums[nums.length - 1];
      if (!best || score > best.score || (score === best.score && idx >= 0)) best = { score, value: v };
      break;
    }
  });
  if (best) h.printedtotal = round2((best as { score: number; value: number }).value);

  // an invoice-level cash discount ("Less CD 4.00 % 48.94") and the value of the goods it comes off
  for (const l of lines) {
    const t = l.text;
    if (h.goodsvalue === null) {
      const g = t.match(/goods\s*value\D{0,6}([0-9,]+\.\d{2})/i);
      if (g) h.goodsvalue = round2(Number(g[1].replace(/,/g, '')));
    }
    if (!h.cashdiscount) {
      const c = t.match(/(?:less\s*:?\s*c\.?\s*d\.?|cash\s*disc\w*)\s*([0-9]+(?:\.[0-9]+)?)?\s*%?\D{0,6}([0-9,]+\.\d{2})/i);
      if (c) h.cashdiscount = { pct: c[1] ? Number(c[1]) : null, amount: round2(Number(c[2].replace(/,/g, ''))) };
    }
  }
  return h;
}

// ---------------------------------------------------------------------------------------------------------- the table
type Key = 'desc' | 'pack' | 'hsn' | 'batch' | 'exp' | 'mrp' | 'qty' | 'free' | 'rate' | 'disc' | 'tax' | 'amount' | 'sl' | 'unk';
const COLS: Array<[Key, RegExp]> = [
  ['sl', /^(sl|sr|s\.?no|sno|#)\.?$/],
  ['desc', /^(product|description|item|items|particulars|particular|goods|medicine|drug)\b/],
  ['pack', /^(pack|packing|uom)\b/],
  ['hsn', /^(hsn|sac)/],
  ['batch', /^(batch|b\.?\s?no|batchno)/],
  ['exp', /^(exp|expiry|expdt|exp\.)/],
  ['mrp', /^(mrp|m\.r\.p)/],
  ['qty', /^(qty|quantity|qnty)\b/],
  ['free', /^(free|fr|scheme|bonus)\b/],
  ['rate', /^(rate|ptr|pts|price|prate)\b/],
  ['disc', /^(disc|dis|discount|d%)/],
  ['tax', /^(gst|tax|igst|cgst|sgst|vat)/],
  ['amount', /^(amount|amt|value|total|net)\b/],
];
const CANON: Array<[Key, string[]]> = [
  ['desc', ['product', 'description', 'particulars', 'item']], ['batch', ['batch']], ['exp', ['exp', 'expiry']], ['mrp', ['mrp']],
  ['qty', ['qty', 'quantity']], ['free', ['free']], ['rate', ['rate', 'ptr', 'pts']], ['disc', ['disc', 'dis', 'discount']],
  ['tax', ['gst', 'tax']], ['amount', ['amount', 'amt', 'value']], ['hsn', ['hsn']], ['pack', ['pack']],
];
const ALIAS: Record<string, Key> = { mr: 'mrp', mp: 'mrp' };
const NOT_A_COLUMN = new Set(['date', 'dated', 'page', 'name', 'late', 'gate', 'state', 'rep', 'due', 'order', 'place', 'mode', 'terms', 'code', 'bank', 'branch', 'phone', 'email', 'area', 'supply', 'ref']);

function lev(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const keyOf = (t: string): Key | null => {
  const w0 = t.toLowerCase().replace(/[%:]+$/g, '').trim();
  for (const [k, re] of COLS) if (re.test(w0)) return k;
  // a photo's header is often misread by a letter ("SEXP" for EXP, "REE" for FREE): one slip is allowed
  const w = w0.replace(/[^a-z]/g, '');
  if (NOT_A_COLUMN.has(w)) return null;
  if (ALIAS[w]) return ALIAS[w];
  if (w.length >= 3) for (const [k, names] of CANON) for (const n of names) if (n.length >= 3 && Math.abs(n.length - w.length) <= 1 && lev(w, n) <= 1) return k;
  return null;
};

interface Anchor { key: Key; x0: number; x1: number }

function headerScore(words: Word[]): { anchors: Anchor[]; score: number } {
  const anchors: Anchor[] = [];
  const seen: Record<string, number> = {};
  const unknown: Word[] = [];
  for (const w of words) {
    const k = keyOf(w.t);
    if (!k) { if (/[A-Za-z]{2,}/.test(w.t)) unknown.push(w); continue; }
    seen[k] = (seen[k] || 0) + 1;
    if (k === 'desc' && seen[k] > 1) continue;
    if (['batch', 'exp', 'mrp', 'qty', 'free', 'rate', 'disc', 'amount', 'hsn', 'pack', 'sl'].includes(k) && seen[k] > 1) continue;
    anchors.push({ key: k, x0: w.x0, x1: w.x1 });
  }
  const keys = new Set(anchors.map((a) => a.key));
  const need = ['qty'].every((k) => keys.has(k as Key)) && (keys.has('rate') || keys.has('amount'));
  const score = Array.from(keys).filter((k) => k !== 'sl').length;
  if (need) {
    // a header word that is not a column name: the rest of a name ("PRODUCT NAME", "Batch No.", "Exp. Dt") joins the column right
    // before it; any other (misread by OCR) holds its place so the columns around it keep their edges
    for (const w of unknown) {
      const near = anchors
        .filter((a) => w.x0 > a.x0 && w.x0 - a.x1 < Math.max(14, (a.x1 - a.x0) * 0.6))
        .sort((a, b) => b.x1 - a.x1)[0];
      if (near) near.x1 = Math.max(near.x1, w.x1);
      else anchors.push({ key: 'unk', x0: w.x0, x1: w.x1 });
    }
  }
  return { anchors, score: need ? score : 0 };
}

/** the header word for MRP is often the one OCR drops; the numbers under it are still there, between the rate column and the next */
function inferMrpColumn(anchors: Anchor[], lines: TextLine[], from: number) {
  if (anchors.some((a) => a.key === 'mrp')) return;
  const rate = anchors.find((a) => a.key === 'rate');
  if (!rate) return;
  const next = anchors.filter((a) => a.x0 > rate.x1).sort((a, b) => a.x0 - b.x0)[0];
  const limit = next ? next.x0 : Infinity;
  const hits: Word[] = [];
  let rows = 0;
  for (let i = from; i < lines.length && rows < 30; i++) {
    if (STOP.test(lines[i].text.trim())) break;
    const inGap = lines[i].words.filter((w) => /^\d+\.\d{2}$/.test(w.t) && w.x0 > rate.x1 + 4 && w.x1 < limit);
    if (inGap.length) { hits.push(...inGap); rows++; }
  }
  if (rows >= 2) anchors.push({ key: 'mrp', x0: Math.min(...hits.map((w) => w.x0)), x1: Math.max(...hits.map((w) => w.x1)) });
}

/** a piece of an expiry written in words or split over words: a month name or a year */
const expiryPart = (t: string) => !!readExpiry(t) || !!MONTHS[t.slice(0, 4).toLowerCase()] || !!MONTHS[t.slice(0, 3).toLowerCase()] || /^\d{2}(\d{2})?$/.test(t);
const NUMERIC = new Set<Key>(['qty', 'free', 'rate', 'mrp', 'disc', 'tax', 'amount']);
/** how many different column names a line has */
const keyCount = (words: Word[]) => new Set(words.map((w) => keyOf(w.t)).filter((k) => k && k !== 'sl')).size;

const STOP_RE = /^(?:[#\d\s.:|*-]*(?:sub\s*total|grand\s*total|total\b)|amount\s*in\s*words|rupees|terms|tax\s*summary|gst\s*summary|hsn\s*summary|bank\s*details|declaration|e\.?\s*&\s*o\.?\s*e|for\s+[A-Z])|\bgoods\s*value\b|\bless\s*:?\s*c\.?\s*d\b|\badd\s*gst\b|\binvoice\s*(?:amt|amount|value|total)\b/i;
const STOP = { test: (text: string) => STOP_RE.test(text) };

export function parseInvoice(lines: TextLine[], opts: { ownGstin?: string | null; knownGstins?: string[] } = {}): ParsedInvoice {
  const header = readHeader(lines, opts.ownGstin, opts.knownGstins || []);
  const warnings: string[] = [];

  // find the header row of the item table (it may be printed over two lines)
  let hi = -1, anchors: Anchor[] = [], headerLines = 1;
  let bestScore = 0;
  for (let i = 0; i < lines.length; i++) {
    const one = headerScore(lines[i].words);
    if (one.score >= 4 && one.score > bestScore) { hi = i; anchors = one.anchors; headerLines = 1; bestScore = one.score; }
    const nxt = lines[i + 1];
    // a header printed over two lines: the first has real column names of its own and the second adds to them (a stray line of
    // "Date  Page" above a header is not part of it)
    if (nxt && nxt.page === lines[i].page && Math.abs(nxt.y - lines[i].y) < lines[i].h * 2.6 && keyCount(lines[i].words) >= 3 && keyCount(nxt.words) >= 1) {
      const two = headerScore([...lines[i].words, ...nxt.words]);
      if (two.score >= 4 && two.score > bestScore + 1) { hi = i; anchors = two.anchors; headerLines = 2; bestScore = two.score; }
    }
  }
  if (hi < 0) {
    warnings.push('The item table was not found: no row with column names like Batch, Exp, Qty and Rate.');
    return { header, lines: [], warnings, tableFound: false };
  }

  anchors.sort((a, b) => (a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2);
  inferMrpColumn(anchors, lines, hi + headerLines);
  anchors.sort((a, b) => (a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2);
  const bounds = anchors.map((a, i) => (i < anchors.length - 1 ? (a.x1 + anchors[i + 1].x0) / 2 : Infinity));
  const colOf = (w: Word) => {
    const cx = (w.x0 + w.x1) / 2;
    if (cx < anchors[0].x0 - 6 && anchors[0].key !== 'sl') return anchors[0].key === 'desc' ? 'desc' : 'sl';
    for (let i = 0; i < anchors.length; i++) if (cx < bounds[i]) return anchors[i].key;
    return anchors[anchors.length - 1].key;
  };

  const rows: ExtractedLine[] = [];
  const headerWords = new Set(anchors.map((a) => a.key));
  let last: ExtractedLine | null = null;
  for (let i = hi + headerLines; i < lines.length; i++) {
    const l = lines[i];
    if (STOP.test(l.text.trim())) break;
    if (headerScore(l.words).score >= 4) continue;                                     // the header again on the next page
    const cells: Partial<Record<Key, string[]>> = {};
    const taxCells: string[] = [];
    for (const w of l.words) {
      let k = colOf(w);
      // a product name starts left of its (centred) header, so its first words can sit over the expiry column; an expiry looks like
      // 04/29 wherever it sits; a number column holds numbers, so a word with letters in it (150GM) is part of the name
      if (headerWords.has('exp') && /[\/\-]/.test(w.t) && readExpiry(w.t)) k = 'exp';
      else if (k === 'exp' && headerWords.has('desc') && !expiryPart(w.t)) k = 'desc';
      else if (NUMERIC.has(k) && w.t.length >= 3 && /[A-Za-z]{2,}/.test(w.t) && headerWords.has('desc')) k = 'desc';
      if (k === 'tax') taxCells.push(w.t);
      (cells[k] = cells[k] || []).push(w.t);
    }
    const txt = (k: Key) => (cells[k] || []).join(' ').trim();
    let qty = headerWords.has('qty') ? readNumber(txt('qty')) : null;
    let qtyWorkedOut = false;
    let free = headerWords.has('free') ? readNumber(txt('free')) : null;
    const qtyRaw = txt('qty');
    const plus = qtyRaw.match(/^(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)$/);               // "10+2": bought + free
    if (plus) { qty = +plus[1]; free = +plus[2]; }
    const rate = headerWords.has('rate') ? readNumber(txt('rate')) : null;
    const amountRead = headerWords.has('amount') ? readNumber(txt('amount')) : null;
    // OCR often drops the small quantity digit: it is the amount over the rate, when that comes out as a whole number
    if ((qty === null || !(qty > 0)) && rate !== null && rate > 0 && amountRead !== null && amountRead > 0) {
      const dd = headerWords.has('disc') ? (readNumber(txt('disc')) ?? 0) : 0;
      const q = amountRead / (rate * (1 - dd / 100));
      if (q >= 1 && q <= 100000 && Math.abs(q - Math.round(q)) <= 0.02) { qty = Math.round(q); qtyWorkedOut = true; }
    }

    const isItem = qty !== null && qty > 0 && (rate !== null || amountRead !== null) && /[A-Za-z]/.test(txt('desc') || txt('batch') || '');
    if (!isItem) {
      // a wrapped product name continues the row above
      if (last && !qtyRaw && !txt('rate') && !txt('amount') && /[A-Za-z0-9]{2,}/.test(txt('desc')) && !/^(batch|exp)/i.test(txt('desc'))) {
        last.description = `${last.description} ${txt('desc')}`.replace(/\s+/g, ' ').trim();
      }
      continue;
    }

    const taxNums = allNumbers(taxCells.join(' '));
    const tax = taxNums.length ? round2(taxNums.reduce((a, b) => a + b, 0)) : null;
    const disc = headerWords.has('disc') ? readNumber(txt('disc')) : null;
    // marks that are not text (a pen mark, a stray "*ok" for "**") are dropped from the ends of the name
    const nameWords = txt('desc').replace(/^\d{1,3}\s+(?=\D)/, '').replace(/\s+/g, ' ').trim().split(' ');
    while (nameWords.length > 1 && /^([^A-Za-z0-9]+|[*+][A-Za-z]{1,2})$/.test(nameWords[nameWords.length - 1])) nameWords.pop();
    const description = nameWords.join(' ');
    const warn: string[] = [];
    if (qtyWorkedOut) warn.push('Quantity worked out from the amount and the rate: check it.');
    let r = rate;
    const d = disc ?? 0;
    if (r === null && amountRead !== null && qty) { r = round2(amountRead / (qty * (1 - d / 100))); warn.push('Rate worked out from the amount.'); }
    const base = qty !== null && r !== null ? round2(qty * r * (1 - d / 100)) : null;
    if (base !== null && amountRead !== null) {
      const tol = Math.max(1, base * 0.01);
      const taxed = round2(base * (1 + (tax ?? 0) / 100));
      if (Math.abs(base - amountRead) > tol && Math.abs(taxed - amountRead) > tol) warn.push(`Amount ${amountRead} does not match quantity x rate (${base}). Check the digits.`);
    }
    const batch = txt('batch').replace(/\s+/g, '').replace(/^[*#.:\-]+|[*#.:]+$/g, '').toUpperCase() || null;
    const expText = txt('exp');
    const expdate = expText ? readExpiry(expText.replace(/\s+/g, expText.match(/[A-Za-z]/) ? ' ' : '')) : null;
    if (!batch) warn.push('No batch read.');
    if (!expdate) warn.push(expText ? `Expiry "${expText}" could not be read.` : 'No expiry read.');
    const mrp = headerWords.has('mrp') ? readNumber(txt('mrp')) : null;
    if (headerWords.has('mrp') && mrp === null) warn.push('No MRP read.');
    const row: ExtractedLine = {
      description, hsn: headerWords.has('hsn') ? (txt('hsn').replace(/\s+/g, '') || null) : null, batch, expdate, mrp, qty, free: free ?? 0, rate: r,
      disc: disc ?? 0, tax, amount: base, amountRead, warnings: warn,
    };
    rows.push(row);
    last = row;
  }
  if (!rows.length) warnings.push('The item table was found but no item rows could be read from it.');
  return { header, lines: rows, warnings, tableFound: true };
}

/** what the lines add up to with tax, to set beside the printed total (after an invoice-level cash discount, when one is printed) */
export function linesTotalWithTax(lines: ExtractedLine[], header?: ExtractedHeader | null): number {
  return round2(lines.reduce((t, l) => t + (l.amount ?? 0) * (1 + (l.tax ?? 0) / 100), 0) * cashFactor(lines, header));
}

/** 1, or the share left after a cash discount printed under the goods value ("Less CD 4.00 %  48.94") */
export function cashFactor(lines: ExtractedLine[], header?: ExtractedHeader | null): number {
  const cd = header?.cashdiscount?.amount;
  if (!cd) return 1;
  const goods = lines.reduce((t, l) => t + (l.amount ?? 0), 0);
  if (!(goods > 0) || cd >= goods) return 1;
  if (header?.goodsvalue && Math.abs(header.goodsvalue - goods) > Math.max(2, goods * 0.02)) return 1;     // the lines are not the whole invoice: do not guess
  return (goods - cd) / goods;
}
