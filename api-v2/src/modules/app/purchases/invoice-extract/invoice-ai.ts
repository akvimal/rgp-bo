import { Tool } from '../../alerts/ai-provider';
import { ExtractedHeader, ExtractedLine, ParsedInvoice, isGstin, linesTotalWithTax, readDate, readExpiry } from './invoice-parser';
import { TieOut, tieOut } from './invoice-tieout';

/**
 * Reading an invoice copy with the assistant. The model only reads what is printed; every figure that can be worked out is worked out here, and the
 * result is checked against the invoice's own total before a person sees it. Pure, so it is tested without a model.
 * Bump PROMPT_VERSION when the instructions change: it is part of what a kept answer is based on.
 */
export const PROMPT_VERSION = 'v1';

/** the setting ai.invoice_read: off (the default), text (the words the plain reader found), or full (those, then the pictures when the words are not enough) */
export type InvoiceReadMode = 'off' | 'text' | 'full';
export const parseMode = (v: unknown): InvoiceReadMode => {
  const t = String(v ?? '').trim().toLowerCase();
  return t === 'text' || t === 'full' ? t : 'off';
};

const NUM = { type: ['number', 'null'] };
const STR = { type: ['string', 'null'] };

export const READ_INVOICE_TOOL: Tool = {
  name: 'read_invoice',
  description: 'Record what is printed on a purchase invoice: the header and every item line, exactly as printed.',
  input_schema: {
    type: 'object',
    properties: {
      invoice_no: { ...STR, description: 'The supplier\'s invoice number (next to "Invoice No", "Inv. No" or "Bill No"). Not the buyer\'s address number, the order number or the customer code.' },
      invoice_date: { ...STR, description: 'The invoice date as YYYY-MM-DD (invoices are day first: 10/11/2026 is 2026-11-10). Not the order date or the due date.' },
      supplier_name: { ...STR, description: 'The company that issued the invoice (the seller), without addresses or codes.' },
      supplier_gstin: { ...STR, description: 'The seller\'s 15 character GSTIN, not the buyer\'s.' },
      printed_total: { ...NUM, description: 'The grand total payable on this invoice, as printed (after rounding).' },
      goods_value: { ...NUM, description: 'The value of the goods before an invoice level discount, when printed (for example "Sale Value" or "Goods Value").' },
      cash_discount_amount: { ...NUM, description: 'An invoice level cash discount amount printed under the goods value ("Cash Disc", "Less CD"), as a positive number.' },
      lines: {
        type: 'array',
        description: 'One entry for every item row of the invoice table, in order. Do not include totals rows.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'The product name as printed.' },
            hsn: { ...STR, description: 'HSN code, digits only.' },
            batch: { ...STR, description: 'Batch number as printed.' },
            expiry: { ...STR, description: 'Expiry as printed, for example 04/29 or APR-29.' },
            mrp: { ...NUM, description: 'MRP per pack as printed.' },
            qty: { ...NUM, description: 'The quantity billed (the QTY column). Not the pack size. Null when it cannot be read: do not work it out.' },
            free_qty: { ...NUM, description: 'Free quantity (FREE or SCM column), when printed.' },
            rate: { ...NUM, description: 'The price per unit before tax as printed (Rate, PTR, Trade price). Not the MRP.' },
            discount_percent: { ...NUM, description: 'The discount percent printed for this row, when there is one.' },
            gst_percent: { ...NUM, description: 'The GST percent for this row (CGST plus SGST added together, or IGST). 5 for "GST 5%" or "GST_5%".' },
            amount: { ...NUM, description: 'The row\'s value as printed in the last amount column (Value, Total or Taxable value).' },
            unsure: { type: 'array', items: { type: 'string' }, description: 'Names of the fields of this row that are hard to read, such as batch or expiry.' },
          },
          required: ['description'],
        },
      },
    },
    required: ['lines'],
  },
};

export const SYSTEM_PROMPT = [
  'You read purchase invoices of Indian pharmacy suppliers and record exactly what is printed.',
  'The invoice is addressed to a pharmacy (the buyer); the details you record are the seller\'s.',
  'Record only what you can see. Never invent a value and never calculate one: when something is not printed or not legible, leave it null.',
  'Do not mix columns: Pack is not Qty, MRP is not Rate, the discount column is not the rate.',
  'Include every item row and nothing else (no totals, tax summaries or bank details).',
  'Call the tool read_invoice with the result.',
].join(' ');

/** the words the plain reader found, with the instruction for them; long text is cut (an invoice is a page or two) */
export function textInstruction(text: string, ownGstin: string | null): string {
  const body = String(text ?? '').slice(0, 14000);
  return [
    'Below is the text read from a scanned purchase invoice by a plain reader. It can contain misread or dropped characters, words from other columns on the same line, and stray marks.',
    ownGstin ? `The buyer's own GSTIN is ${ownGstin}: it is not the seller's.` : '',
    'Record the header and every item row. Use the printed value of a row to tell which numbers belong to which column.',
    '',
    '<invoice_text>', body, '</invoice_text>',
  ].filter((x) => x !== '').join('\n');
}

export function pictureInstruction(pages: number, ownGstin: string | null): string {
  return [
    `The ${pages === 1 ? 'picture is' : pages + ' pictures are the pages of'} a scanned or photographed purchase invoice.`,
    ownGstin ? `The buyer's own GSTIN is ${ownGstin}: it is not the seller's.` : '',
    'Record the header and every item row, reading the columns by their printed headings.',
  ].filter((x) => x !== '').join('\n');
}

// ---------------------------------------------------------------------------------------------------------- the model's answer, made into lines
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹\s]|rs\.?/gi, ''));
  return Number.isFinite(n) ? n : null;
};
const pos = (v: any): number | null => { const n = num(v); return n !== null && n >= 0 ? n : null; };
const text = (v: any, max: number): string | null => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s ? s.slice(0, max) : null; };
const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * A row's printed amount tells how the row is priced: the quantity times the rate, with or without the row's discount, with or without its tax.
 * The discount is taken from that, not from the model: a discount column that the invoice deducts at the foot (a cash discount) is not a row discount.
 */
export function impliedDiscount(qty: number | null, rate: number | null, tax: number | null, amount: number | null, said: number | null): number | null {
  if (!qty || rate === null || amount === null) return said;
  const plain = qty * rate;
  if (!(plain > 0)) return said;
  const tol = Math.max(1, plain * 0.01);
  const t = 1 + (tax ?? 0) / 100;
  if (Math.abs(plain - amount) <= tol || Math.abs(plain * t - amount) <= tol) return 0;        // the amount is quantity x rate: no row discount
  if (said && said > 0 && said < 100) {
    const d = 1 - said / 100;
    if (Math.abs(plain * d - amount) <= tol || Math.abs(plain * d * t - amount) <= tol) return said;
  }
  for (const base of [amount, amount / t]) {                                                   // what the amount implies
    const d = Math.round((1 - base / plain) * 1000) / 10;
    if (d > 0 && d < 50) return d;
  }
  return said;
}

/** a quantity the model could not read: the whole number that makes quantity x rate equal the printed amount (with or without tax) */
export function quantityFromAmount(rate: number | null, tax: number | null, amount: number | null): number | null {
  if (!rate || rate <= 0 || amount === null || amount <= 0) return null;
  for (const unit of [rate, rate * (1 + (tax ?? 0) / 100)]) {
    const q = amount / unit;
    const whole = Math.round(q);
    if (whole >= 1 && whole <= 100000 && Math.abs(q - whole) <= Math.max(0.02, whole * 0.004)) return whole;
  }
  return null;
}

export interface AiRead { parsed: ParsedInvoice; derived: number; rows: number }

/** the model's answer as the lines and header the form works with; null when it holds no item rows */
export function fromAi(out: any): AiRead | null {
  const rows: any[] = Array.isArray(out?.lines) ? out.lines.slice(0, 300) : [];
  const date = text(out?.invoice_date, 10);
  const gstin = String(out?.supplier_gstin ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cd = pos(out?.cash_discount_amount);
  const header: ExtractedHeader = {
    invoiceno: text(out?.invoice_no, 40)?.toUpperCase() ?? null,
    invoicedate: isDate(date) ? date : (date ? readDate(date) : null),
    duedate: null,
    suppliergstin: isGstin(gstin) ? gstin : null,
    suppliername: text(out?.supplier_name, 100),
    printedtotal: pos(out?.printed_total) !== null ? r2(pos(out?.printed_total) as number) : null,
    goodsvalue: pos(out?.goods_value) !== null ? r2(pos(out?.goods_value) as number) : null,
    cashdiscount: cd ? { pct: null, amount: r2(cd) } : null,
  };
  let derived = 0;
  const lines: ExtractedLine[] = [];
  for (const r of rows) {
    const description = text(r?.description, 200);
    if (!description) continue;
    const warnings: string[] = ['Read by the assistant: check it against the invoice.'];
    const tax = pos(r?.gst_percent);
    const rate = pos(r?.rate);
    const amountRead = pos(r?.amount);
    let qty = pos(r?.qty);
    if (qty === null || qty === 0) {
      const q = quantityFromAmount(rate, tax, amountRead);
      if (q !== null) { qty = q; derived++; warnings.push(`The quantity was not read: ${q} is worked out from the amount and the rate. Check it.`); }
    }
    const disc = impliedDiscount(qty, rate, tax, amountRead, pos(r?.discount_percent));
    const exp = text(r?.expiry, 20);
    const expdate = exp ? readExpiry(exp) : null;
    if (exp && !expdate) warnings.push(`The expiry "${exp}" could not be understood.`);
    const unsure: string[] = Array.isArray(r?.unsure) ? r.unsure.map((x: any) => String(x).slice(0, 30)).filter(Boolean).slice(0, 6) : [];
    if (unsure.length) warnings.push(`Hard to read: ${unsure.join(', ')}.`);
    const hsn = String(r?.hsn ?? '').replace(/\D/g, '');
    const amount = qty !== null && rate !== null ? r2(qty * rate * (1 - (disc ?? 0) / 100)) : null;
    lines.push({
      description, hsn: hsn.length >= 4 && hsn.length <= 8 ? hsn : null, batch: text(r?.batch, 40), expdate, mrp: pos(r?.mrp), qty, free: pos(r?.free_qty) ?? 0,
      rate, disc: disc ?? 0, tax, amount, amountRead, warnings,
    });
  }
  if (!lines.length) return null;
  return { parsed: { header, lines, warnings: [], tableFound: true }, derived, rows: lines.length };
}

// ---------------------------------------------------------------------------------------------------------- is it good enough, which is better
export interface Candidate { parsed: ParsedInvoice; tie: TieOut }

export const judge = (parsed: ParsedInvoice): Candidate => ({ parsed, tie: tieOut(parsed, linesTotalWithTax(parsed.lines, parsed.header)) });

/** the plain reading is not enough: nothing was read, or it does not agree with the invoice's own total, or it has no total to be checked against */
export const needsAssistant = (c: Candidate): boolean => !c.parsed.lines.length || c.tie.status !== 'RECONCILED';

const RANK = { RECONCILED: 3, UNVERIFIED: 2, REVIEW: 1 } as const;
const fails = (c: Candidate) => c.tie.checks.filter((k) => k.state === 'fail').length;

/** the better of two readings: one that agrees with the invoice total beats one that does not; then fewer failed checks; then more lines. Ties go to `a`. */
export function better(a: Candidate, b: Candidate): Candidate {
  if (!b.parsed.lines.length) return a;
  if (!a.parsed.lines.length) return b;
  const ra = RANK[a.tie.status], rb = RANK[b.tie.status];
  if (ra !== rb) return ra > rb ? a : b;
  if (fails(a) !== fails(b)) return fails(a) < fails(b) ? a : b;
  return b.parsed.lines.length > a.parsed.lines.length ? b : a;
}

/** the header fields a reading lacks, filled from another (the plain reader sometimes finds a field the model missed) */
export function fillHeader(to: ExtractedHeader, from: ExtractedHeader, only?: string[]): ExtractedHeader {
  const out: any = { ...to };
  for (const k of Object.keys(out)) if (!only || only.includes(k)) if ((out[k] === null || out[k] === undefined) && (from as any)[k] !== null && (from as any)[k] !== undefined) out[k] = (from as any)[k];
  return out;
}
