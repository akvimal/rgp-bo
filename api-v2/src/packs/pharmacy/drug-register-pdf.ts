import { join } from 'path';
import PDFDocument = require('pdfkit');

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');
const IST = 'Asia/Kolkata';
const stamp = (d: Date) => d.toLocaleString('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const day = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });

export interface RegisterHead { business: string; address?: string; gstin?: string; title: string; from: string; to: string; generatedAt: Date; }

// A4 landscape: 842 x 595 points
const L = 28, W = 786, TOP = 28, ROW_H = 31, FIRST_Y = 112, FOOT_Y = 568;
const COLS = [
  { label: 'Register no', w: 52 }, { label: 'Date and time', w: 64 }, { label: 'Bill', w: 34 }, { label: 'Patient and address', w: 160 },
  { label: 'Prescriber, reg. no and address', w: 170 }, { label: 'Drug', w: 130 }, { label: 'Batch, expiry', w: 66 }, { label: 'Units', w: 32 }, { label: 'Supplied by', w: 78 },
];

/**
 * The register as it is printed and signed: one line for each scheduled drug supplied, in the register's own numbering, with the patient and the
 * prescriber, ready for an inspector. Every page says what it covers and when it was printed.
 */
export function buildRegisterPdf(rows: any[], h: RegisterHead): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: TOP, left: L, right: L, bottom: 20 }, bufferPages: true, info: { Title: h.title, Author: h.business, Subject: 'Register of scheduled drugs' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('R', join(FONT_DIR, 'NotoSans-Regular.ttf'));
    doc.registerFont('B', join(FONT_DIR, 'NotoSans-Bold.ttf'));

    const heading = () => {
      doc.font('B').fontSize(13).fillColor('#111827').text(h.title, L, TOP, { width: W });
      doc.font('R').fontSize(9).fillColor('#374151').text(`${h.business}${h.gstin ? '  ·  GSTIN ' + h.gstin : ''}${h.address ? '  ·  ' + h.address : ''}`, L, doc.y, { width: W });
      doc.font('R').fontSize(9).fillColor('#6b7280').text(`Supplied from ${day(h.from)} to ${day(h.to)}  ·  ${rows.length} line${rows.length === 1 ? '' : 's'}  ·  printed ${stamp(h.generatedAt)}`, L, doc.y, { width: W });
    };
    const header = (y: number) => {
      doc.rect(L, y - 2, W, 15).fill('#e5e7eb');
      let x = L;
      doc.font('B').fontSize(7.5).fillColor('#111827');
      for (const c of COLS) { doc.text(c.label, x + 2, y + 1, { width: c.w - 4, lineBreak: false, ellipsis: true }); x += c.w; }
    };
    const cell = (text: string, x: number, y: number, w: number, bold = false, muted = false, lines = 1) => {
      doc.font(bold ? 'B' : 'R').fontSize(7.5).fillColor(muted ? '#6b7280' : '#111827').text(text, x + 2, y, { width: w - 4, height: 9.5 * lines, lineBreak: lines > 1, ellipsis: true });
    };

    heading();
    let y = FIRST_Y;
    header(y);
    y += 17;
    rows.forEach((r, i) => {
      if (y + ROW_H > FOOT_Y - 6) { doc.addPage(); y = TOP; header(y); y += 17; }
      if (i % 2) doc.rect(L, y - 2, W, ROW_H).fill('#f9fafb');
      if (r.superseded) doc.rect(L, y - 2, W, ROW_H).fill('#fef2f2');
      let x = L;
      const put = (w: number, fn: () => void) => { fn(); x += w; };
      put(COLS[0].w, () => cell(r.label, x, y, COLS[0].w, true));
      put(COLS[1].w, () => { const [d, t] = String(r.entry_on).split(' '); cell(day(d), x, y, COLS[1].w); cell(t || '', x, y + 10, COLS[1].w, false, true); });
      put(COLS[2].w, () => cell(String(r.bill_no ?? ''), x, y, COLS[2].w));
      put(COLS[3].w, () => { cell(`${r.patient_name}${r.patient_age ? ', ' + r.patient_age : ''}`, x, y, COLS[3].w, true); cell(r.patient_address || '', x, y + 10, COLS[3].w, false, true, 2); });
      put(COLS[4].w, () => { cell(`${r.prescriber_name}${r.prescriber_reg_no ? ' (Reg. ' + r.prescriber_reg_no + ')' : ''}`, x, y, COLS[4].w, true); cell(r.prescriber_address || '', x, y + 10, COLS[4].w, false, true, 2); });
      put(COLS[5].w, () => cell(`${r.drug_name} [${r.schedule}]`, x, y, COLS[5].w, false, false, 2));
      put(COLS[6].w, () => { cell(r.batch || '', x, y, COLS[6].w); cell(r.exp_date ? day(r.exp_date).slice(3) : '', x, y + 10, COLS[6].w, false, true); });
      put(COLS[7].w, () => cell(String(r.qty), x, y, COLS[7].w, true));
      put(COLS[8].w, () => cell(r.supplied_by || '', x, y, COLS[8].w, false, false, 2));
      y += ROW_H;
    });
    if (!rows.length) doc.font('R').fontSize(10).fillColor('#6b7280').text('No scheduled drug was supplied in this period.', L, y + 6, { width: W });
    else {
      if (y > FOOT_Y - 50) { doc.addPage(); y = TOP; }
      doc.font('R').fontSize(9).fillColor('#111827').text('Checked by the pharmacist-in-charge: ______________________________    Date: ________________    Signature: ______________________________', L, y + 10, { width: W });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.font('R').fontSize(7.5).fillColor('#6b7280');
      doc.text(`${h.title}  ·  ${day(h.from)} to ${day(h.to)}  ·  printed ${stamp(h.generatedAt)}`, L, 578, { width: 560, lineBreak: false });
      doc.text(`Page ${i + 1} of ${range.count}`, L + 680, 578, { width: 106, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
