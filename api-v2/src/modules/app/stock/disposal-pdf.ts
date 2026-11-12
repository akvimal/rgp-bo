import { join } from 'path';
import PDFDocument = require('pdfkit');

const NAVY = '#012970';
const GREY = '#6b7280';
const LINE = '#9ca3af';
const FILL = '#eef1f7';
const FONT_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');

const money = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const monthYear = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : '');

/** what the printed pass says about where it stands, so a pass not yet confirmed is never taken for the final one */
export function passMark(status: string): string {
  switch (String(status || '').toUpperCase()) {
    case 'DRAFT': return 'WAITING FOR APPROVAL';
    case 'APPROVED': return 'APPROVED - GOODS NOT YET HANDED OVER';
    case 'REJECTED': return 'REJECTED';
    case 'CANCELLED': return 'CANCELLED';
    default: return '';
  }
}

/** The out-pass as a one-page document with the lines, the totals and a place to sign for each person who took part. */
export function buildDisposalPdf(pass: any, opts: { business: string; address?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 20 }, bufferPages: true, info: { Title: `Out-pass ${pass.pass_no}`, Author: opts.business } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('R', join(FONT_DIR, 'NotoSans-Regular.ttf'));
    doc.registerFont('B', join(FONT_DIR, 'NotoSans-Bold.ttf'));

    const L = 40, W = 515, R = L + W, BOTTOM = 842 - 60;
    const put = (t: any, x: number, y: number, o: { w?: number; bold?: boolean; size?: number; color?: string; align?: 'left' | 'right' | 'center' } = {}) => {
      doc.font(o.bold ? 'B' : 'R').fontSize(o.size ?? 9).fillColor(o.color ?? '#111827');
      doc.text(`${t ?? ''}`, x, y, { width: o.w, align: o.align ?? 'left', lineBreak: o.w !== undefined });
    };

    // the header band
    doc.rect(L, 40, W, 46).fill(NAVY);
    put(opts.business, L + 10, 48, { bold: true, size: 13, color: '#ffffff', w: 330 });
    if (opts.address) put(opts.address, L + 10, 66, { size: 8, color: '#dbe4ff', w: 330 });
    put('OUT-PASS', R - 190, 46, { bold: true, size: 15, color: '#ffffff', w: 180, align: 'right' });
    put(pass.pass_no, R - 190, 66, { size: 10, color: '#ffffff', w: 180, align: 'right' });

    let y = 96;
    const mark = passMark(pass.status);
    if (mark) { put(mark, L, y, { bold: true, size: 10, color: '#b91c1c', w: W, align: 'center' }); y += 18; }

    // the facts of the pass
    const facts: Array<[string, string]> = [
      ['Store', pass.store || ''], ['Date', day(pass.prepared_on)],
      ['Reason', pass.reason_label || ''], ['Method', pass.method_label || ''],
      ['Disposal agency / carrier', pass.agency || '-'], ['Goods left on', pass.handed_on ? day(pass.handed_on) : '-'],
    ];
    facts.forEach(([k, v], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      put(k, L + col * 260, y + row * 26, { size: 8, color: GREY, w: 250 });
      put(v, L + col * 260, y + row * 26 + 10, { bold: true, size: 10, w: 250 });
    });
    y += 3 * 26 + 6;
    if (pass.notes) { put(`Notes: ${pass.notes}`, L, y, { size: 9, w: W }); y += doc.heightOfString(`Notes: ${pass.notes}`, { width: W }) + 6; }
    if (pass.legacy) { put('Disposed earlier and recorded now: no witness or evidence is held for this pass.', L, y, { size: 9, color: '#92400e', w: W }); y += 16; }

    // the lines
    const cols = [{ t: '#', x: L, w: 22, a: 'left' as const }, { t: 'Product', x: L + 24, w: 190, a: 'left' as const }, { t: 'Batch', x: L + 216, w: 70, a: 'left' as const }, { t: 'Expiry', x: L + 288, w: 48, a: 'left' as const },
      { t: 'Qty', x: L + 338, w: 38, a: 'right' as const }, { t: 'Cost', x: L + 380, w: 56, a: 'right' as const }, { t: 'GST', x: L + 438, w: 36, a: 'right' as const }, { t: 'MRP value', x: L + 474, w: 41, a: 'right' as const }];
    const header = () => {
      doc.rect(L, y, W, 16).fill(FILL);
      cols.forEach((c) => put(c.t, c.x + 2, y + 4, { bold: true, size: 8, w: c.w - 4, align: c.a }));
      y += 18;
    };
    header();
    (pass.lines || []).forEach((l: any, i: number) => {
      const title = `${l.title}${l.schedule ? ` [${l.schedule}]` : ''}`;
      const h = Math.max(14, doc.font('R').fontSize(9).heightOfString(title, { width: 186 }) + 4);
      if (y + h > BOTTOM - 150) { doc.addPage(); y = 50; header(); }
      const cells = [String(i + 1), title, l.batch || '', monthYear(l.exp_date), String(l.qty), money(l.cost_value), money(l.tax_value), money(l.mrp_value)];
      cols.forEach((c, k) => put(cells[k], c.x + 2, y + 2, { size: 9, w: c.w - 4, align: c.a }));
      y += h;
      doc.moveTo(L, y).lineTo(R, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    });
    y += 4;
    const t = pass.totals || {};
    put(`Total: ${t.qty ?? 0} units  |  at cost ${money(t.cost)}  |  GST on cost ${money(t.tax)}  |  at MRP ${money(t.mrp)}`, L, y, { bold: true, size: 9, w: W, align: 'right' });
    y += 18;

    const reg = (pass.lines || []).filter((l: any) => l.reg_serial);
    if (reg.length) {
      put(`Disposal register (scheduled drugs): ${reg.map((l: any) => `${l.reg_schedule} no. ${l.reg_serial}`).join(', ')}`, L, y, { size: 9, w: W });
      y += 16;
    }

    // who signs
    if (y > BOTTOM - 110) { doc.addPage(); y = 60; }
    y = Math.max(y + 20, BOTTOM - 90);
    const sig = [
      { cap: 'Prepared by', name: pass.prepared_by_name, on: pass.prepared_on },
      { cap: 'Approved by', name: pass.approved_by_name, on: pass.approved_on },
      { cap: 'Handed over / destroyed by', name: pass.confirmed_by_name, on: pass.confirmed_on },
      { cap: pass.witness_id ? 'Witness' : 'Received by (agency / vendor)', name: pass.witness_id ? pass.witness_name : '', on: null },
    ];
    const bw = (W - 3 * 12) / 4;
    sig.forEach((s, i) => {
      const x = L + i * (bw + 12);
      doc.moveTo(x, y + 28).lineTo(x + bw, y + 28).strokeColor(LINE).lineWidth(0.8).stroke();
      put(s.name || '', x, y + 14, { size: 9, w: bw });
      put(s.cap, x, y + 32, { bold: true, size: 8, w: bw });
      if (s.on) put(day(s.on), x, y + 43, { size: 8, color: GREY, w: bw });
    });

    doc.end();
  });
}
