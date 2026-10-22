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
  expdate: string | null;       // last day of the month printed, YYYY-MM-DD
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

/** an expiry as printed (08/27, 8-2027, Aug-27, AUG 2027): the last day of that month */
export function readExpiry(s: string): string | null {
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
  if (!mo || mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `${y}-${pad(mo)}-${pad(last)}`;
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

// ---------------------------------------------------------------------------------------------------------- the header
const NOT_VALUE = /^(date|dt|no|number|dated|of|the|and|gstin|gst|to|from|bill|invoice)$/i;

function readHeader(lines: TextLine[], ownGstin?: string | null): ExtractedHeader {
  const h: ExtractedHeader = { invoiceno: null, invoicedate: null, duedate: null, suppliergstin: null, suppliername: null, printedtotal: null };
  const own = String(ownGstin || '').toUpperCase();

  // supplier: the first GSTIN that is not the buyer's own; its name is the largest-looking line above it
  for (const l of lines) {
    const hits = (l.text.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g) || []).filter((g) => g !== own);
    const good = hits.find(isGstin) || null;
    if (good) { h.suppliergstin = good; break; }
  }
  const first = lines.slice(0, 6).find((l) => /[A-Za-z]{3,}/.test(l.text) && !/invoice|gstin|tax|original|duplicate|page|cash|credit/i.test(l.text));
  if (first) h.suppliername = first.text.replace(/\s+/g, ' ').trim().slice(0, 100);

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
    [/net\s*(?:amount|payable|value)/i, 6], [/amount\s*payable/i, 6], [/grand\s*total/i, 5], [/invoice\s*(?:value|total|amount)/i, 5],
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
  return h;
}

// ---------------------------------------------------------------------------------------------------------- the table
type Key = 'desc' | 'pack' | 'hsn' | 'batch' | 'exp' | 'mrp' | 'qty' | 'free' | 'rate' | 'disc' | 'tax' | 'amount' | 'sl';
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
const keyOf = (t: string): Key | null => {
  const w = t.toLowerCase().replace(/[%:]+$/g, '').trim();
  for (const [k, re] of COLS) if (re.test(w)) return k;
  return null;
};

interface Anchor { key: Key; x0: number; x1: number }

function headerScore(words: Word[]): { anchors: Anchor[]; score: number } {
  const anchors: Anchor[] = [];
  const seen: Record<string, number> = {};
  for (const w of words) {
    const k = keyOf(w.t);
    if (!k) continue;
    seen[k] = (seen[k] || 0) + 1;
    if (k === 'desc' && seen[k] > 1) continue;
    if (['batch', 'exp', 'mrp', 'qty', 'free', 'rate', 'disc', 'amount', 'hsn', 'pack', 'sl'].includes(k) && seen[k] > 1) continue;
    anchors.push({ key: k, x0: w.x0, x1: w.x1 });
  }
  const keys = new Set(anchors.map((a) => a.key));
  const need = ['qty'].every((k) => keys.has(k as Key)) && (keys.has('rate') || keys.has('amount'));
  const score = Array.from(keys).filter((k) => k !== 'sl').length;
  return { anchors, score: need ? score : 0 };
}

const STOP = /^(sub\s*total|total\b|grand\s*total|amount\s*in\s*words|rupees|terms|tax\s*summary|gst\s*summary|hsn\s*summary|bank\s*details|declaration|e\.?\s*&\s*o\.?\s*e|for\s+[A-Z])/i;

export function parseInvoice(lines: TextLine[], opts: { ownGstin?: string | null } = {}): ParsedInvoice {
  const header = readHeader(lines, opts.ownGstin);
  const warnings: string[] = [];

  // find the header row of the item table (it may be printed over two lines)
  let hi = -1, anchors: Anchor[] = [], headerLines = 1;
  let bestScore = 0;
  for (let i = 0; i < lines.length; i++) {
    const one = headerScore(lines[i].words);
    if (one.score >= 4 && one.score > bestScore) { hi = i; anchors = one.anchors; headerLines = 1; bestScore = one.score; }
    const nxt = lines[i + 1];
    if (nxt && nxt.page === lines[i].page && Math.abs(nxt.y - lines[i].y) < lines[i].h * 2.6) {
      const two = headerScore([...lines[i].words, ...nxt.words]);
      if (two.score >= 4 && two.score > bestScore + 1) { hi = i; anchors = two.anchors; headerLines = 2; bestScore = two.score; }
    }
  }
  if (hi < 0) {
    warnings.push('The item table was not found: no row with column names like Batch, Exp, Qty and Rate.');
    return { header, lines: [], warnings, tableFound: false };
  }

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
      const k = colOf(w);
      if (k === 'tax') taxCells.push(w.t);
      (cells[k] = cells[k] || []).push(w.t);
    }
    const txt = (k: Key) => (cells[k] || []).join(' ').trim();
    let qty = headerWords.has('qty') ? readNumber(txt('qty')) : null;
    let free = headerWords.has('free') ? readNumber(txt('free')) : null;
    const qtyRaw = txt('qty');
    const plus = qtyRaw.match(/^(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)$/);               // "10+2": bought + free
    if (plus) { qty = +plus[1]; free = +plus[2]; }
    const rate = headerWords.has('rate') ? readNumber(txt('rate')) : null;
    const amountRead = headerWords.has('amount') ? readNumber(txt('amount')) : null;

    const isItem = qty !== null && qty > 0 && (rate !== null || amountRead !== null) && /[A-Za-z]/.test(txt('desc') || txt('batch') || '');
    if (!isItem) {
      // a wrapped product name continues the row above
      if (last && !qtyRaw && !txt('rate') && !txt('amount') && txt('desc') && !/^(batch|exp)/i.test(txt('desc'))) {
        last.description = `${last.description} ${txt('desc')}`.replace(/\s+/g, ' ').trim();
      }
      continue;
    }

    const taxNums = allNumbers(taxCells.join(' '));
    const tax = taxNums.length ? round2(taxNums.reduce((a, b) => a + b, 0)) : null;
    const disc = headerWords.has('disc') ? readNumber(txt('disc')) : null;
    const description = txt('desc').replace(/^\d{1,3}\s+(?=\D)/, '').replace(/\s+/g, ' ').trim();
    const warn: string[] = [];
    let r = rate;
    const d = disc ?? 0;
    if (r === null && amountRead !== null && qty) { r = round2(amountRead / (qty * (1 - d / 100))); warn.push('Rate worked out from the amount.'); }
    const base = qty !== null && r !== null ? round2(qty * r * (1 - d / 100)) : null;
    if (base !== null && amountRead !== null) {
      const tol = Math.max(1, base * 0.01);
      const taxed = round2(base * (1 + (tax ?? 0) / 100));
      if (Math.abs(base - amountRead) > tol && Math.abs(taxed - amountRead) > tol) warn.push(`Amount ${amountRead} does not match quantity x rate (${base}). Check the digits.`);
    }
    const batch = txt('batch').replace(/\s+/g, '').toUpperCase() || null;
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

/** what the lines add up to with tax, to set beside the printed total */
export function linesTotalWithTax(lines: ExtractedLine[]): number {
  return round2(lines.reduce((t, l) => t + (l.amount ?? 0) * (1 + (l.tax ?? 0) / 100), 0));
}
