import { join } from 'path';
import PDFDocument = require('pdfkit');

/** Who the order is from and where it goes, as printed. Anything missing is left out of the page. */
export interface PoBuyer {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  licences?: { label: string; numbers: string }[];
  /** the store the goods go to, when it has its own address */
  deliverTo?: string;
}

export interface PoPdfOptions {
  buyer: PoBuyer | null;          // null: the buyer's details are switched off in the settings
  terms: string[];
  preparedBy?: string;
  generatedAt?: Date;
}

const NAVY = '#012970';
const GREY = '#6b7280';
const LINE = '#9ca3af';
const FILL = '#eef1f7';
const FONT_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');

const TAMIL = /[஀-௿]/;

/** what an order not yet sent to the vendor is stamped with, so a draft is never taken for the real thing */
export function poStatusMark(status: string): string {
  switch (`${status || ''}`.toUpperCase()) {
    case 'PENDING': return 'DRAFT';
    case 'PENDING_APPROVAL': return 'AWAITING APPROVAL';
    case 'REJECTED': return 'REJECTED';
    default: return '';
  }
}

export const DEFAULT_PO_TERMS = [
  'Please supply the above items as per the agreed rates and schedule.',
  'Goods should be delivered against this purchase order number.',
  'Invoice should quote this PO number for settlement.',
];

const money = (n: number) => (+n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? `${v}` : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** A purchase order as a PDF: buyer and vendor, the items with pack, quantity and estimated rate and amount, totals, terms, signatures. */
export function buildPoPdf(order: any, opts: PoPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 20 }, bufferPages: true,
      info: { Title: `Purchase Order ${order.ponumber || order.id}`, Author: opts.buyer?.name || 'Purchase order', Subject: `Purchase order to ${order.vendor?.name || ''}` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('R', join(FONT_DIR, 'NotoSans-Regular.ttf'));
    doc.registerFont('B', join(FONT_DIR, 'NotoSans-Bold.ttf'));
    doc.registerFont('I', join(FONT_DIR, 'NotoSans-Italic.ttf'));
    doc.registerFont('TR', join(FONT_DIR, 'NotoSansTamil-Regular.ttf'));
    doc.registerFont('TB', join(FONT_DIR, 'NotoSansTamil-Bold.ttf'));

    const L = 40, W = 515, R = L + W, BOTTOM = 842 - 60;
    /** the font for a piece of text: Tamil letters need the Tamil face */
    const face = (text: string, bold = false, italic = false) => TAMIL.test(text) ? (bold ? 'TB' : 'TR') : (bold ? 'B' : (italic ? 'I' : 'R'));
    const put = (text: string, x: number, y: number, o: { w?: number; bold?: boolean; italic?: boolean; size?: number; color?: string; align?: 'left' | 'right' | 'center' } = {}) => {
      const s = `${text ?? ''}`;
      doc.font(face(s, o.bold, o.italic)).fontSize(o.size ?? 9).fillColor(o.color ?? '#111827');
      doc.text(s, x, y, { width: o.w, align: o.align ?? 'left', lineBreak: o.w !== undefined });
    };
    const heightOf = (text: string, w: number, o: { bold?: boolean; italic?: boolean; size?: number } = {}) => {
      doc.font(face(`${text}`, o.bold, o.italic)).fontSize(o.size ?? 9);
      return doc.heightOfString(`${text}`, { width: w });
    };

    // ---------------------------------------------------------------- the header band
    const header = () => {
      doc.rect(L, 40, W, 50).fill(NAVY);
      put('PURCHASE ORDER', L + 12, 54, { size: 18, bold: true, color: '#ffffff' });
      put(`PO No. ${order.ponumber || order.id}`, L + 300, 48, { w: 203, size: 12, bold: true, color: '#ffffff', align: 'right' });
      put(`Date ${day(order.createdon)}`, L + 300, 64, { w: 203, size: 9, color: '#ffffff', align: 'right' });
      if (order.expecteddate) put(`Expected delivery ${day(order.expecteddate)}`, L + 300, 76, { w: 203, size: 9, color: '#ffffff', align: 'right' });
    };
    header();

    // ---------------------------------------------------------------- buyer and vendor
    const vendor = order.vendor || {};
    const party = (title: string, lines: { text: string; bold?: boolean; italic?: boolean }[], x: number, y: number, w: number) => {
      const inner = w - 20;
      let h = 26;
      lines.forEach((l) => { h += heightOf(l.text, inner, { bold: l.bold, size: l.bold ? 10 : 9 }) + 2; });
      return { x, y, w, h: h + 6, lines, title, inner };
    };
    const drawParty = (p: ReturnType<typeof party>, h: number) => {
      doc.rect(p.x, p.y, p.w, h).lineWidth(0.8).stroke(LINE);
      doc.rect(p.x, p.y, p.w, 18).fill(FILL);
      put(p.title.toUpperCase(), p.x + 10, p.y + 5, { size: 8, bold: true, color: NAVY });
      let yy = p.y + 24;
      p.lines.forEach((l) => {
        put(l.text, p.x + 10, yy, { w: p.inner, bold: l.bold, italic: l.italic, size: l.bold ? 10 : 9 });
        yy += heightOf(l.text, p.inner, { bold: l.bold, size: l.bold ? 10 : 9 }) + 2;
      });
    };

    const buyerLines: { text: string; bold?: boolean }[] = [];
    if (opts.buyer) {
      buyerLines.push({ text: opts.buyer.name, bold: true });
      if (opts.buyer.address) buyerLines.push({ text: opts.buyer.address });
      if (opts.buyer.phone) buyerLines.push({ text: `Phone: ${opts.buyer.phone}` });
      if (opts.buyer.gstin) buyerLines.push({ text: `GSTIN: ${opts.buyer.gstin}` });
      (opts.buyer.licences || []).forEach((l) => buyerLines.push({ text: `${l.label}: ${l.numbers}` }));
    }
    const vendorLines: { text: string; bold?: boolean }[] = [{ text: vendor.name || '-', bold: true }];
    if (vendor.address) vendorLines.push({ text: vendor.address });
    const contact = [vendor.contactname, vendor.contactphone].filter(Boolean).join(' · ');
    if (contact) vendorLines.push({ text: `Contact: ${contact}` });
    if (vendor.email) vendorLines.push({ text: `Email: ${vendor.email}` });
    if (vendor.gstn) vendorLines.push({ text: `GSTIN: ${vendor.gstn}` });

    const top = 104;
    const half = (W - 10) / 2;
    const vp = party('Vendor', vendorLines, L, top, opts.buyer ? half : W);
    const bp = opts.buyer ? party('Buyer', buyerLines, L + half + 10, top, half) : null;
    const partyH = Math.max(vp.h, bp ? bp.h : 0);
    drawParty(vp, partyH);
    if (bp) drawParty(bp, partyH);
    let y = top + partyH + 10;

    if (opts.buyer?.deliverTo) {
      const h = heightOf(opts.buyer.deliverTo, W - 100, { size: 9 }) + 10;
      doc.rect(L, y, W, h).lineWidth(0.8).stroke(LINE);
      put('Deliver to', L + 10, y + 5, { size: 8, bold: true, color: NAVY });
      put(opts.buyer.deliverTo, L + 90, y + 5, { w: W - 100, size: 9 });
      y += h + 10;
    }

    // ---------------------------------------------------------------- the items
    const cols = { no: L, item: L + 26, pack: L + 262, hsn: L + 296, qty: L + 346, rate: L + 392, amt: L + 450 };
    const widths = { no: 22, item: 232, pack: 30, hsn: 46, qty: 42, rate: 54, amt: 65 };
    const tableHead = () => {
      doc.rect(L, y, W, 20).fill(FILL);
      doc.rect(L, y, W, 20).lineWidth(0.8).stroke(LINE);
      put('#', cols.no + 2, y + 6, { w: widths.no, size: 8, bold: true, color: NAVY });
      put('ITEM', cols.item, y + 6, { size: 8, bold: true, color: NAVY });
      put('PACK', cols.pack, y + 6, { w: widths.pack, size: 8, bold: true, color: NAVY, align: 'right' });
      put('HSN', cols.hsn, y + 6, { w: widths.hsn, size: 8, bold: true, color: NAVY, align: 'right' });
      put('QTY', cols.qty, y + 6, { w: widths.qty, size: 8, bold: true, color: NAVY, align: 'right' });
      put('EST. RATE', cols.rate, y + 6, { w: widths.rate, size: 8, bold: true, color: NAVY, align: 'right' });
      put('EST. AMOUNT', cols.amt - 4, y + 6, { w: widths.amt - 2, size: 8, bold: true, color: NAVY, align: 'right' });
      y += 20;
    };
    tableHead();

    const requests: any[] = order.requests || [];
    let totalQty = 0, totalValue = 0;
    requests.forEach((req, i) => {
      const qty = +(req.orderedqty ?? req.qty) || 0;
      const rate = +req.unitcost || 0;
      const amount = +req.linevalue || +(rate * qty).toFixed(2);
      totalQty += qty; totalValue += amount;
      const title = `${req.product?.title || '-'}`;
      const comp = `${req.product?.props?.composition || ''}`;
      const h = Math.max(20, heightOf(title, widths.item, { size: 9 }) + (comp ? heightOf(comp, widths.item, { italic: true, size: 7.5 }) : 0) + 8);
      if (y + h > BOTTOM - 40) { doc.addPage(); y = 40; tableHead(); }
      doc.moveTo(L, y + h).lineTo(R, y + h).lineWidth(0.5).stroke('#d1d5db');
      doc.moveTo(L, y).lineTo(L, y + h).lineWidth(0.8).stroke(LINE);
      doc.moveTo(R, y).lineTo(R, y + h).lineWidth(0.8).stroke(LINE);
      put(`${i + 1}`, cols.no + 2, y + 5, { w: widths.no, size: 9, color: GREY });
      put(title, cols.item, y + 4, { w: widths.item, size: 9 });
      if (comp) put(comp, cols.item, y + 4 + heightOf(title, widths.item, { size: 9 }), { w: widths.item, size: 7.5, italic: true, color: GREY });
      put(`${req.product?.pack || '-'}`, cols.pack, y + 5, { w: widths.pack, size: 9, align: 'right' });
      put(`${req.product?.hsn || '-'}`, cols.hsn, y + 5, { w: widths.hsn, size: 9, align: 'right' });
      put(`${qty}`, cols.qty, y + 5, { w: widths.qty, size: 9, bold: true, align: 'right' });
      put(rate ? money(rate) : '-', cols.rate, y + 5, { w: widths.rate, size: 9, align: 'right' });
      put(amount ? money(amount) : '-', cols.amt - 4, y + 5, { w: widths.amt - 2, size: 9, align: 'right' });
      y += h;
    });
    if (!requests.length) {
      doc.rect(L, y, W, 26).lineWidth(0.8).stroke(LINE);
      put('No items on this order.', L + 10, y + 8, { size: 9, color: GREY });
      y += 26;
    }

    // ---------------------------------------------------------------- totals
    if (y + 80 > BOTTOM) { doc.addPage(); y = 40; }
    y += 10;
    const tw = 210, tx = R - tw;
    doc.rect(tx, y, tw, 58).lineWidth(0.8).stroke(LINE);
    const trow = (label: string, value: string, yy: number, bold = false) => {
      put(label, tx + 10, yy, { size: bold ? 10 : 9, bold, color: bold ? NAVY : '#111827' });
      put(value, tx + 90, yy, { w: tw - 100, size: bold ? 10 : 9, bold, align: 'right', color: bold ? NAVY : '#111827' });
    };
    trow('Total items', `${requests.length}`, y + 7);
    trow('Total quantity', `${totalQty}`, y + 21);
    trow('Estimated value', `₹ ${money(totalValue)}`, y + 38, true);
    put('Rates are estimates from the last purchase. The invoice rate applies.', L, y + 7, { w: tw + 40, size: 8, italic: true, color: GREY });
    y += 70;

    // ---------------------------------------------------------------- notes and terms
    const section = (title: string, lines: string[], numbered: boolean) => {
      const heights = lines.map((l) => heightOf(l, W - 20, { size: 8.5 }) + 3);
      const need = 16 + heights.reduce((a, b) => a + b, 0);
      if (y + need > BOTTOM) { doc.addPage(); y = 40; }
      put(title, L, y, { size: 9, bold: true, color: NAVY });
      y += 15;
      lines.forEach((l, i) => {
        put(numbered ? `${i + 1}.` : '', L, y, { size: 8.5, color: GREY });
        put(l, L + (numbered ? 16 : 0), y, { w: W - 20, size: 8.5 });
        y += heights[i];
      });
      y += 8;
    };
    if (order.comments) section('Notes', [`${order.comments}`], false);
    const terms = opts.terms.length ? opts.terms : DEFAULT_PO_TERMS;
    section('Terms & Conditions', terms, true);

    // ---------------------------------------------------------------- signatures
    if (y + 80 > BOTTOM) { doc.addPage(); y = 40; }
    y += 24;
    const sx1 = L, sx2 = L + 280, sw = 215;
    put(`For ${opts.buyer?.name || ''}`.trim(), sx1, y - 14, { w: sw, size: 8.5, color: GREY });
    doc.moveTo(sx1, y + 24).lineTo(sx1 + sw, y + 24).lineWidth(0.7).stroke('#111827');
    put('Authorised signatory' + (opts.preparedBy ? ` (prepared by ${opts.preparedBy})` : ''), sx1, y + 28, { w: sw, size: 8.5, bold: true });
    doc.moveTo(sx2, y + 24).lineTo(sx2 + sw, y + 24).lineWidth(0.7).stroke('#111827');
    put('Vendor acceptance', sx2, y + 28, { w: sw, size: 8.5, bold: true });
    put('Signature, seal and date', sx2, y + 40, { w: sw, size: 8, color: GREY });

    // ---------------------------------------------------------------- every page: status mark, page numbers
    const mark = poStatusMark(order.status);
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      if (mark) {
        doc.save();
        doc.rotate(-35, { origin: [297, 420] });
        doc.fillOpacity(0.1);
        doc.font('B').fontSize(mark.length > 8 ? 56 : 96).fillColor('#b91c1c');
        doc.text(mark, 0, 380, { width: 595, align: 'center', lineBreak: false });
        doc.restore();
      }
      doc.fillOpacity(1);
      doc.moveTo(L, 842 - 48).lineTo(R, 842 - 48).lineWidth(0.5).stroke('#d1d5db');
      put(`Generated ${day(opts.generatedAt || new Date())}${mark ? ` · ${mark}` : ''}`, L, 842 - 40, { w: 300, size: 8, color: GREY });
      put(`Page ${i - range.start + 1} of ${range.count}`, R - 120, 842 - 40, { w: 120, size: 8, color: GREY, align: 'right' });
    }
    doc.end();
  });
}
