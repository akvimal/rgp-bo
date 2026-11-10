import PDFDocument = require('pdfkit');

export interface BillShop { name: string; address?: string | null; phone?: string | null; legalName?: string | null; gstin?: string | null }
export interface BillLine { title: string; batch?: string | null; expDate?: string | null; qty: number; mrp?: number | null; price: number; taxPcnt?: number | null; total: number }
export interface BillData {
  shop: BillShop;
  label: string;                       // the bill or tax invoice number
  taxInvoice: boolean;
  date: Date;
  customer: string | null;
  mobile?: string | null;
  lines: BillLine[];
  discount: number;
  total: number;
  cash: number;
  digital: number;
  digitalMethod?: string | null;
  due: number;
  returnDays?: number | null;
}

const NAVY = '#012970';
const GREY = '#6b7280';
const LINE = '#9ca3af';
const money = (n: number) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
const expiry = (v?: string | null) => (v && /^\d{4}-\d{2}/.test(v) ? `${v.slice(5, 7)}/${v.slice(2, 4)}` : '');
const fmtDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * A customer's copy of a bill, as a one-or-more page PDF (A5). The page uses the standard fonts, which cannot draw Tamil, so product and shop names are
 * printed as they are stored; anything outside the Latin range is replaced by a question mark rather than breaking the file.
 */
export function buildBillPdf(b: BillData): Promise<Buffer> {
  const safe = (s: any) => String(s ?? '').replace(/[^\x20-\x7e -ÿ₹]/g, '?').replace('₹', 'Rs ');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 28, info: { Title: `Bill ${safe(b.label)}`, Author: safe(b.shop.name) } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14).text(safe(b.shop.name), left, doc.y, { width, align: 'center' });
    doc.fillColor(GREY).font('Helvetica').fontSize(8);
    if (b.shop.legalName && b.shop.legalName !== b.shop.name) doc.text(safe(b.shop.legalName), { width, align: 'center' });
    if (b.shop.address) doc.text(safe(b.shop.address), { width, align: 'center' });
    const contact = [b.shop.phone ? `Phone ${b.shop.phone}` : '', b.shop.gstin ? `GSTIN ${b.shop.gstin}` : ''].filter(Boolean).join('   ');
    if (contact) doc.text(safe(contact), { width, align: 'center' });
    doc.moveDown(0.5);

    doc.fillColor('#000').font('Helvetica-Bold').fontSize(10).text(b.taxInvoice ? 'TAX INVOICE' : 'BILL', { width, align: 'center' });
    doc.moveDown(0.3).font('Helvetica').fontSize(9);
    const y0 = doc.y;
    doc.text(`No: ${safe(b.label)}`, left, y0, { width: width / 2 });
    doc.text(`Date: ${fmtDate(b.date)}`, left + width / 2, y0, { width: width / 2, align: 'right' });
    if (b.customer) doc.text(`Customer: ${safe(b.customer)}${b.mobile ? '  (' + safe(b.mobile) + ')' : ''}`, left, doc.y, { width });
    doc.moveDown(0.4);

    // columns: item, batch/exp, qty, rate, amount
    const col = { item: left, batch: left + width * 0.42, qty: left + width * 0.62, rate: left + width * 0.72, amt: left + width * 0.86 };
    const head = () => {
      const y = doc.y;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
      doc.text('Item', col.item, y + 3, { width: col.batch - col.item - 4 });
      doc.text('Batch / Exp', col.batch, y + 3, { width: col.qty - col.batch - 4 });
      doc.text('Qty', col.qty, y + 3, { width: col.rate - col.qty - 4, align: 'right' });
      doc.text('Rate', col.rate, y + 3, { width: col.amt - col.rate - 4, align: 'right' });
      doc.text('Amount', col.amt, y + 3, { width: right - col.amt, align: 'right' });
      const y2 = y + 15;
      doc.moveTo(left, y2).lineTo(right, y2).stroke();
      doc.y = y2 + 3;
    };
    head();
    doc.font('Helvetica').fontSize(8);
    for (const l of b.lines) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 90) { doc.addPage(); head(); doc.font('Helvetica').fontSize(8); }
      const y = doc.y;
      const itemH = doc.heightOfString(safe(l.title), { width: col.batch - col.item - 4 });
      doc.text(safe(l.title), col.item, y, { width: col.batch - col.item - 4 });
      doc.text([safe(l.batch), expiry(l.expDate)].filter(Boolean).join(' / '), col.batch, y, { width: col.qty - col.batch - 4 });
      doc.text(String(l.qty), col.qty, y, { width: col.rate - col.qty - 4, align: 'right' });
      doc.text(money(l.price), col.rate, y, { width: col.amt - col.rate - 4, align: 'right' });
      doc.text(money(l.total), col.amt, y, { width: right - col.amt, align: 'right' });
      doc.y = y + Math.max(itemH, 10) + 2;
    }
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(LINE).stroke();
    doc.moveDown(0.3);

    const row = (label: string, value: string, bold = false) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8.5).fillColor('#000');
      doc.text(label, col.qty - 40, y, { width: col.amt - col.qty + 40 - 4, align: 'right' });
      doc.text(value, col.amt, y, { width: right - col.amt, align: 'right' });
      doc.y = y + (bold ? 14 : 11);
    };
    if (b.discount > 0) row('Discount', '-' + money(b.discount));
    row('Total', money(b.total), true);
    if (b.cash > 0) row('Cash', money(b.cash));
    if (b.digital > 0) row(`Paid${b.digitalMethod ? ' (' + safe(b.digitalMethod) + ')' : ' digitally'}`, money(b.digital));
    if (b.due > 0) row('Balance due', money(b.due));

    doc.moveDown(0.8).font('Helvetica').fontSize(7.5).fillColor(GREY);
    if (b.returnDays) doc.text(`Returns accepted within ${b.returnDays} days with this bill.`, left, doc.y, { width, align: 'center' });
    doc.text('Thank you for shopping with us.', left, doc.y, { width, align: 'center' });
    doc.end();
  });
}
