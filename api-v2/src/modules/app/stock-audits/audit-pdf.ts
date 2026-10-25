import { join } from 'path';
import PDFDocument = require('pdfkit');
import { expectedOf } from './audit-rules';

const FONT_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');
const IST = 'Asia/Kolkata';
export const stamp = (d: Date) => d.toLocaleString('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }) : '');
const money = (n: number) => (+n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface AuditHead {
  business: string; address?: string; gstin?: string;
  no: string; store: string; scope: string; category: string | null; plan: string | null;
  startedOn: Date | null; finishedAt: Date | null; completedOn: Date | null; counter: string | null; generatedAt: Date;
}
export interface SheetLine {
  title: string; batch: string; exp_date: string | null; pack: number | null; schedule: string | null;
  book_qty: number; expected_qty: number | null; moved_other: number; counted_qty: number | null; recount_qty: number | null; unit_cost: number | null; sold_since: number; status?: string | null;
}

const L = 36, W = 523;

function open(title: string, h: AuditHead) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 36, left: L, right: L, bottom: 30 }, bufferPages: true, info: { Title: `${title} ${h.no}`, Author: h.business, Subject: `Stock audit ${h.no}` } });
  const chunks: Buffer[] = [];
  doc.registerFont('R', join(FONT_DIR, 'NotoSans-Regular.ttf'));
  doc.registerFont('B', join(FONT_DIR, 'NotoSans-Bold.ttf'));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('data', (c: Buffer) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  return { doc, done };
}

function heading(doc: any, title: string, h: AuditHead) {
  doc.font('B').fontSize(15).fillColor('#111827').text(title, L, 36, { width: W });
  doc.font('R').fontSize(9).fillColor('#374151').text(`${h.business}${h.gstin ? '  ·  GSTIN ' + h.gstin : ''}`, L, doc.y, { width: W });
  if (h.address) doc.fillColor('#6b7280').text(h.address, L, doc.y, { width: W });
  doc.moveDown(0.4);
  const rows: [string, string][] = [
    ['Audit number', h.no], ['Store', h.store],
    ['Covers', h.category ? `${h.scope}: ${h.category}` : h.scope], ['Plan', h.plan || 'One-off'],
  ];
  let y = doc.y;
  rows.forEach(([k, v], i) => {
    const x = L + (i % 2) * 262, yy = y + Math.floor(i / 2) * 14;
    doc.font('R').fontSize(8.5).fillColor('#6b7280').text(k, x, yy, { width: 80 });
    doc.font('B').fontSize(9).fillColor('#111827').text(v, x + 82, yy, { width: 176 });
  });
  doc.y = y + 30;
  doc.x = L;
}

function footers(doc: any, h: AuditHead, what: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('R').fontSize(7.5).fillColor('#6b7280');
    doc.text(`${h.no}  ·  ${what}  ·  printed ${stamp(h.generatedAt)}`, L, 806, { width: 400, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, L + 423, 806, { width: 100, align: 'right', lineBreak: false });
  }
}

type Col = { label: string; w: number; align?: 'left' | 'right' | 'center' };

function tableHeader(doc: any, cols: Col[], y: number) {
  doc.rect(L, y - 2, W, 15).fill('#e5e7eb');
  let x = L;
  doc.font('B').fontSize(8).fillColor('#111827');
  for (const c of cols) { doc.text(c.label, x + 2, y + 1, { width: c.w - 4, align: c.align || 'left', lineBreak: false }); x += c.w; }
}

function tableRows(doc: any, cols: Col[], rows: string[][], opts: { rowH: number; bottom: number; top: number; marked?: (i: number) => boolean; boxFrom?: number }) {
  let y = doc.y;
  tableHeader(doc, cols, y);
  y += 17;
  rows.forEach((r, i) => {
    if (y + opts.rowH > opts.bottom) {
      doc.addPage();
      y = opts.top;
      tableHeader(doc, cols, y);
      y += 17;
    }
    if (opts.marked?.(i)) doc.rect(L, y - 2, W, opts.rowH).fill('#fef3c7');
    else if (i % 2) doc.rect(L, y - 2, W, opts.rowH).fill('#f9fafb');
    let x = L;
    doc.font('R').fontSize(8.5).fillColor('#111827');
    cols.forEach((c, k) => {
      if (opts.boxFrom !== undefined && k >= opts.boxFrom) doc.rect(x + 3, y - 1, c.w - 6, opts.rowH - 3).strokeColor('#9ca3af').lineWidth(0.5).stroke();
      else doc.text(r[k] ?? '', x + 2, y + 1, { width: c.w - 4, height: opts.rowH - 4, align: c.align || 'left', lineBreak: false, ellipsis: true });
      x += c.w;
    });
    y += opts.rowH;
  });
  doc.y = y + 4; doc.x = L;
}

const expiry = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : '');

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** a label in a fixed column with its value beside it */
function pair(doc: any, k: string, v: string, labelW = 150) {
  const y = doc.y;
  doc.font('R').fontSize(9.5).fillColor('#6b7280').text(k, L, y, { width: labelW - 6, lineBreak: false });
  doc.font('B').fontSize(9.5).fillColor('#111827').text(v, L + labelW, y, { width: W - labelW });
  doc.x = L;
  doc.moveDown(0.15);
}

/** the sheet the counter writes on: every batch to count with the book quantity, blank boxes for the count and remarks */
export function buildCountSheetPdf(h: AuditHead, lines: SheetLine[], preview: boolean): Promise<Buffer> {
  const { doc, done } = open('Count sheet', h);
  heading(doc, preview ? 'STOCK COUNT SHEET (preview)' : 'STOCK COUNT SHEET', h);
  doc.font('R').fontSize(8.5).fillColor('#374151').text(
    `Book quantity as at ${stamp(h.startedOn ?? h.generatedAt)}. ${preview ? 'This is a preview: the quantities are fixed when the count is started. ' : ''}Count what is on the shelf, write it in the box, and mark any batch that is damaged or near expiry in Remarks. ${lines.length} line${lines.length === 1 ? "" : "s"}.`,
    L, doc.y, { width: W });
  doc.moveDown(0.5);
  const cols: Col[] = [
    { label: '#', w: 26, align: 'right' }, { label: 'Product', w: 200 }, { label: 'Batch', w: 66 }, { label: 'Exp', w: 38 },
    { label: 'Pack', w: 30, align: 'right' }, { label: 'Book', w: 40, align: 'right' }, { label: 'Counted', w: 52 }, { label: 'Remarks', w: 71 },
  ];
  const rows = lines.map((l, i) => [String(i + 1), `${l.title}${l.schedule ? ' [' + l.schedule + ']' : ''}`, l.batch, expiry(l.exp_date), String(l.pack ?? ''), String(l.book_qty), '', '']);
  tableRows(doc, cols, rows, { rowH: 17, bottom: 780, top: 36, boxFrom: 6 });
  if (!lines.length) doc.font('R').fontSize(10).fillColor('#6b7280').text('Nothing in stock matches this audit.', L, doc.y, { width: W });
  if (doc.y > 720) doc.addPage();
  doc.moveDown(1);
  doc.font('R').fontSize(10).fillColor('#111827');
  doc.text('Counted by: ______________________________    Date and time: ____________________', L, doc.y, { width: W });
  doc.moveDown(1.2);
  doc.text('Counting finished, sheet handed to the Store Head:   ______________________________', L, doc.y, { width: W });
  footers(doc, h, 'Count sheet');
  doc.end();
  return done;
}

export interface Totals { lines: number; counted: number; matchRate: number; shortUnits: number; excessUnits: number; shortValue: number; excessValue: number; netUnits: number; netValue: number; }

/** what the count found: totals, then every line that differed, with the second count of a large difference and what was sold while counting */
export function buildVariancePdf(h: AuditHead, lines: SheetLine[], t: Totals, added: { title: string; batch: string; units: number }[] = []): Promise<Buffer> {
  const { doc, done } = open('Variance report', h);
  heading(doc, 'STOCK COUNT VARIANCE REPORT', h);
  const facts: [string, string][] = [
    ['Counted', `${t.counted} of ${t.lines} lines  ·  ${t.matchRate}% matched what was expected`],
    ['Counting', `${h.startedOn ? stamp(h.startedOn) : ''} to ${h.finishedAt ? stamp(h.finishedAt) : ''}`],
    ['Short', `${plural(t.shortUnits, 'unit', 'units')}  ·  ${money(t.shortValue)} at cost`],
    ['In excess', `${plural(t.excessUnits, 'unit', 'units')}  ·  ${money(t.excessValue)} at cost`],
    ['Net', `${plural(t.netUnits, 'unit', 'units')}  ·  ${money(t.netValue)} at cost`],
  ];
  facts.forEach(([k, v]) => pair(doc, k, v, 80));
  doc.moveDown(0.6);
  const differing = lines.filter((l) => l.counted_qty !== null && (l.recount_qty ?? l.counted_qty) !== expectedOf(l));
  const moved = lines.filter((l) => l.sold_since > 0 || l.moved_other !== 0).length;
  doc.font('B').fontSize(10).fillColor('#111827').text(`Lines that differed: ${differing.length}`, L, doc.y, { width: W });
  doc.font('R').fontSize(8).fillColor('#6b7280').text(`Expected is the book quantity at the start, less what was sold, plus returns, transfers and approved adjustments, up to when counting finished. The difference is the count against Expected, so sales made during the count are not shortages. Shaded lines had such movements (${moved} of ${lines.length} lines). Recount is the second count of a large difference, which replaces the first.`, L, doc.y, { width: W });
  doc.moveDown(0.4);
  const cols: Col[] = [
    { label: 'Product', w: 134 }, { label: 'Batch', w: 54 }, { label: 'Book', w: 30, align: 'right' }, { label: 'Sold', w: 28, align: 'right' }, { label: 'Other', w: 30, align: 'right' },
    { label: 'Expected', w: 40, align: 'right' }, { label: 'Counted', w: 40, align: 'right' }, { label: 'Recount', w: 40, align: 'right' }, { label: 'Diff', w: 30, align: 'right' },
    { label: 'Value', w: 54, align: 'right' }, { label: 'Status', w: 43 },
  ];
  const rows = differing.map((l) => {
    const final = l.recount_qty ?? (l.counted_qty as number);
    const d = final - expectedOf(l);
    return [l.title, l.batch, String(l.book_qty), l.sold_since ? '-' + l.sold_since : '', l.moved_other ? (l.moved_other > 0 ? '+' : '') + l.moved_other : '', String(expectedOf(l)), String(l.counted_qty), l.recount_qty === null ? '' : String(l.recount_qty), (d > 0 ? '+' : '') + d, money(d * (Number(l.unit_cost) || 0)), l.status || ''];
  });
  tableRows(doc, cols, rows, { rowH: 16, bottom: 790, top: 36, marked: (i) => differing[i].sold_since > 0 || differing[i].moved_other !== 0 });
  if (!differing.length) doc.font('R').fontSize(10).fillColor('#047857').text('Every counted line matched the book.', L, doc.y, { width: W });
  if (added.length) {
    if (doc.y > 700) doc.addPage();
    doc.moveDown(0.8);
    doc.font('B').fontSize(10).fillColor('#111827').text('Received during the count, not on the sheet', L, doc.y, { width: W });
    doc.font('R').fontSize(8).fillColor('#6b7280').text('These batches were entered while counting, so they were not counted. Count them at the next audit.', L, doc.y, { width: W });
    doc.moveDown(0.3);
    tableRows(doc, [{ label: 'Product', w: 340 }, { label: 'Batch', w: 120 }, { label: 'Units', w: 63, align: 'right' }], added.map((r) => [r.title, r.batch, String(r.units)]), { rowH: 15, bottom: 790, top: 36 });
  }
  footers(doc, h, 'Variance report');
  doc.end();
  return done;
}

export interface Certificate {
  totals: Totals;
  approved: number; rejected: number; pending: number; escalated: number; recounted: number;
  countedBy: string; certifiedBy: string; certifiedOn: Date; note: string | null; alone: boolean;
}

/** the one page that is signed and filed: what was covered, what was found, how the differences were settled, and two signature lines */
export function buildCertificatePdf(h: AuditHead, c: Certificate): Promise<Buffer> {
  const { doc, done } = open('Certificate', h);
  heading(doc, 'STOCK AUDIT CERTIFICATE', h);
  doc.moveDown(0.3);
  const t = c.totals;
  const kv = (k: string, v: string) => pair(doc, k, v);
  doc.font('B').fontSize(11).fillColor('#1d4ed8').text('What was counted', L, doc.y, { width: W });
  doc.moveDown(0.25);
  kv('Counting started', h.startedOn ? stamp(h.startedOn) : '');
  kv('Counting finished', (h.finishedAt ?? h.completedOn) ? stamp((h.finishedAt ?? h.completedOn) as Date) : '');
  kv('Lines counted', `${t.counted} of ${t.lines}`);
  kv('Matched what was expected', `${t.matchRate}%`);
  doc.moveDown(0.5);
  doc.font('B').fontSize(11).fillColor('#1d4ed8').text('What was found (at cost)', L, doc.y, { width: W });
  doc.moveDown(0.25);
  kv('Short', `${plural(t.shortUnits, 'unit', 'units')}, ${money(t.shortValue)}`);
  kv('In excess', `${plural(t.excessUnits, 'unit', 'units')}, ${money(t.excessValue)}`);
  kv('Net', `${plural(t.netUnits, 'unit', 'units')}, ${money(t.netValue)}`);
  doc.moveDown(0.5);
  doc.font('B').fontSize(11).fillColor('#1d4ed8').text('How the differences were settled', L, doc.y, { width: W });
  doc.moveDown(0.25);
  kv('Adjustments approved', String(c.approved));
  kv('Adjustments rejected', String(c.rejected));
  kv('Large differences', `${c.escalated}, of which counted again: ${c.recounted}`);
  if (c.note) kv('Note', c.note);
  doc.moveDown(0.8);
  doc.font('R').fontSize(9.5).fillColor('#111827').text(
    `We confirm that the stock listed on count sheet ${h.no} was physically counted on the dates shown, that the book quantities were as recorded when counting started, that sales and other stock movements between the start and the end of counting were taken into account, and that the differences were dealt with as stated above.`,
    L, doc.y, { width: W });
  doc.moveDown(1.6);

  const sig = (label: string, name: string, x: number) => {
    const y = doc.y;
    doc.moveTo(x, y + 30).lineTo(x + 235, y + 30).strokeColor('#111827').lineWidth(0.6).stroke();
    doc.font('B').fontSize(10).fillColor('#111827').text(label, x, y + 34, { width: 235 });
    doc.font('R').fontSize(9).fillColor('#374151').text(name, x, y + 48, { width: 235 });
    doc.font('R').fontSize(8).fillColor('#6b7280').text('Signature and date', x, y + 62, { width: 235 });
  };
  const y0 = doc.y;
  if (c.alone) {
    sig('Counted and verified by', `${c.countedBy} (one-person shop)`, L);
  } else {
    sig('Counted by', c.countedBy, L);
    doc.y = y0;
    sig('Verified and approved by', c.certifiedBy, L + 270);
  }
  doc.y = y0 + 95;
  doc.font('R').fontSize(8).fillColor('#6b7280').text(
    `Certified in the system by ${c.certifiedBy} on ${stamp(c.certifiedOn)}. This page is kept as generated; a reprint is the same file. File it with the count sheet and variance report of ${h.no}.`,
    L, doc.y, { width: W });
  footers(doc, h, 'Certificate');
  doc.end();
  return done;
}
