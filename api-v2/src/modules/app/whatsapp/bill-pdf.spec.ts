import { buildBillPdf } from './bill-pdf';
import { renderFooter } from '../../../core/bill-footer';

const base: any = {
  shop: { name: 'RGP Pharmacy', suffix: '®', branch: 'Main Street', address: '1 Main St', phone: '9876543210', gstin: '33ABCDE1234F1Z5', reviewUrl: 'https://g.page/r/abc/review' },
  label: 'B-12', taxInvoice: false, date: new Date('2026-11-12T10:00:00'), customer: 'A', mobile: '9876543210',
  lines: [{ title: 'Para 500', batch: 'B1', expDate: '2027-05-01', qty: 2, mrp: 20, price: 18, taxPcnt: 12, total: 36 }],
  discount: 0, total: 36, cash: 36, digital: 0, due: 0,
  footer: renderFooter('', { store_phone: '9876543210', website: 'www.rgp.in' }),
};

describe('the WhatsApp bill copy', () => {
  it('builds a PDF with the review QR and the footer', async () => {
    const withQr = await buildBillPdf(base);
    const without = await buildBillPdf({ ...base, shop: { ...base.shop, reviewUrl: null } });
    expect(withQr.subarray(0, 5).toString()).toBe('%PDF-');
    expect(withQr.length).toBeGreaterThan(without.length);        // the QR image is in the file
  });
  it('builds with the trade-mark sign and no footer', async () => {
    const pdf = await buildBillPdf({ ...base, shop: { ...base.shop, suffix: '™' }, footer: [] });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
