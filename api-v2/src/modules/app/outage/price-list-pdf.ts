import { join } from 'path';
import PDFDocument = require('pdfkit');
import { PriceListEntry } from './price-list';

const FONT_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');

export interface PriceListHeader {
  /** a pharmacy's list marks prescription-only drugs (Rx) and counts tablets; another business's does not */
  pharmacy?: boolean;
  business: string;
  address?: string;
  gstin?: string;
  generatedAt: Date;
}

const IST = 'Asia/Kolkata';
export const stamp = (d: Date) => d.toLocaleString('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const money = (n: number) => (+n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A4 portrait: 595 x 842 points
const L = 28, W = 539;
const ALL_COLS = [
  { key: 'title', label: 'Product', w: 285, align: 'left' as const },
  { key: 'pack', label: 'Pack', w: 34, align: 'right' as const },
  { key: 'packIncl', label: 'Per pack', w: 66, align: 'right' as const },
  { key: 'unitIncl', label: 'Per unit', w: 60, align: 'right' as const },
  { key: 'mrp', label: 'MRP (pack)', w: 62, align: 'right' as const },
  { key: 'rx', label: 'Rx', w: 32, align: 'center' as const },
];
const columns = (rx: boolean) => (rx ? ALL_COLS : ALL_COLS.filter((c) => c.key !== 'rx').map((c) => (c.key === 'title' ? { ...c, w: c.w + 32 } : c)));
const TOP = 28, FIRST_ROW_Y = 112, ROW_H = 13, FOOT_Y = 818;
export const ROWS_PER_PAGE = Math.floor((FOOT_Y - 8 - FIRST_ROW_Y) / ROW_H);

/**
 * The price list as a PDF to print: alphabetical, what a customer pays with GST per pack and per unit, the MRP, and Rx for prescription-only items.
 * Every page carries when it was printed, the page range of products, and "page x of y", so an old copy is never mistaken for a current one.
 */
export function buildPriceListPdf(entries: PriceListEntry[], h: PriceListHeader): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const COLS = columns(h.pharmacy !== false);
    const doc = new PDFDocument({
      size: 'A4', margins: { top: TOP, left: L, right: L, bottom: 20 }, bufferPages: true,
      info: { Title: `Price list ${stamp(h.generatedAt)}`, Author: h.business, Subject: 'Counter price list for use when the system is down' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('R', join(FONT_DIR, 'NotoSans-Regular.ttf'));
    doc.registerFont('B', join(FONT_DIR, 'NotoSans-Bold.ttf'));

    const pages: PriceListEntry[][] = [];
    for (let i = 0; i < entries.length; i += ROWS_PER_PAGE) pages.push(entries.slice(i, i + ROWS_PER_PAGE));
    if (!pages.length) pages.push([]);
    const printed = stamp(h.generatedAt);

    pages.forEach((rows, p) => {
      if (p > 0) doc.addPage();
      // heading
      doc.font('B').fontSize(13).fillColor('#111827').text('PRICE LIST: for the counter when the system is down', L, TOP, { width: W, lineBreak: false });
      doc.font('R').fontSize(8).fillColor('#374151')
        .text([h.business, h.address, h.gstin ? `GSTIN ${h.gstin}` : ''].filter(Boolean).join('  ·  '), L, TOP + 17, { width: W, lineBreak: false });
      doc.font('B').fontSize(8).fillColor('#b91c1c').text(`Valid as of ${printed}`, L, TOP + 29, { width: W, lineBreak: false, continued: false });
      doc.font('R').fontSize(7.5).fillColor('#374151')
        .text(`Prices include GST. Per unit is one ${h.pharmacy === false ? 'piece' : 'tablet, capsule or piece'}. Only products in stock when this was printed are listed: for anything else ask the Store Head.`, L, TOP + 40, { width: W, lineBreak: false });
      const range = rows.length ? `${rows[0].title.slice(0, 22)}  to  ${rows[rows.length - 1].title.slice(0, 22)}` : '';
      doc.font('R').fontSize(7.5).fillColor('#6b7280').text(range, L, TOP + 51, { width: W, lineBreak: false });

      // table header
      let y = FIRST_ROW_Y - 16;
      doc.rect(L, y, W, 15).fill('#e5e7eb');
      let x = L;
      doc.font('B').fontSize(8).fillColor('#111827');
      for (const c of COLS) { doc.text(c.label, x + 3, y + 4, { width: c.w - 6, align: c.align, lineBreak: false }); x += c.w; }

      // rows
      y = FIRST_ROW_Y;
      rows.forEach((e, i) => {
        if (i % 2 === 1) doc.rect(L, y - 1, W, ROW_H).fill('#f3f4f6');
        x = L;
        const vals: Record<string, string> = {
          title: e.title.length > 62 ? e.title.slice(0, 61) + '…' : e.title, pack: String(e.pack),
          packIncl: money(e.packIncl), unitIncl: money(e.unitIncl), mrp: money(e.mrp), rx: e.rx ? 'Rx' : '',
        };
        for (const c of COLS) {
          doc.font(c.key === 'packIncl' || c.key === 'unitIncl' ? 'B' : 'R').fontSize(8).fillColor(c.key === 'rx' ? '#b91c1c' : '#111827')
            .text(vals[c.key], x + 3, y + 1.5, { width: c.w - 6, align: c.align, lineBreak: false });
          x += c.w;
        }
        y += ROW_H;
      });
      if (!rows.length) doc.font('R').fontSize(9).fillColor('#6b7280').text('No products in stock with a price.', L, FIRST_ROW_Y + 4);
    });

    // footers, once the page count is known
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.moveTo(L, FOOT_Y - 4).lineTo(L + W, FOOT_Y - 4).strokeColor('#9ca3af').lineWidth(0.5).stroke();
      doc.font('R').fontSize(7.5).fillColor('#6b7280')
        .text(`Printed ${printed}. A new list replaces this one.`, L, FOOT_Y, { width: W - 90, lineBreak: false })
        .text(`Page ${i + 1} of ${range.count}`, L + W - 90, FOOT_Y, { width: 90, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
