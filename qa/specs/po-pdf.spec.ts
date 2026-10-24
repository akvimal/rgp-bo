/**
 * The purchase order PDF - POPDF-1..4
 * Buyer and vendor from the business's own details, ordered quantities, a status mark on anything not yet sent, estimated rates and
 * a total, terms the business writes, and as many pages as the items need.
 */
import { test, expect } from '../fixtures/index.js';
import { pdfPages } from '../support/pdf.js';

const MGR = 'businesshead@local.test';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function pdfOf(api: any, id: number) {
  const token = await api.token(MGR);
  const res = await fetch(`${API}/download/po`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
  expect(res.status).toBeLessThan(300);
  expect(res.headers.get('content-type')).toContain('application/pdf');
  return { buf: Buffer.from(await res.arrayBuffer()), disposition: res.headers.get('content-disposition') || '' };
}

async function order(api: any, items: number, qty = 7) {
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
  const prods = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, MGR)).body;
  const seen = new Set<number>(); const picks: any[] = [];
  for (const p of prods) if (!seen.has(p.id) && picks.length < items) { seen.add(p.id); picks.push(p); }
  const po = await api.request('POST', '/purchaseorders', { vendorid: vendor.id, comments: 'Deliver to the back door', expecteddate: '2030-02-14' }, MGR);
  for (const p of picks) {
    const rq = await api.request('POST', '/purchaserequests', { productid: p.id, qty, vendorid: vendor.id, status: 'Open' }, MGR);
    await api.request('PUT', `/purchaserequests/${rq.body.id}`, { orderid: po.body.id }, MGR);
  }
  return { id: po.body.id as number, vendor, picks };
}

const setSetting = async (api: any, key: string, value: string) => {
  const all = (await api.request('GET', '/settings?category=purchases', undefined, MGR)).body as any[];
  const cur = all.find((x) => x.key === key);
  const body = { category: 'purchases', key, value, description: key };
  return cur ? api.request('PUT', `/settings/${cur.id}`, body, MGR) : api.request('POST', '/settings', body, MGR);
};

const setTerms = async (api: any, value: string) => {
  const all = (await api.request('GET', '/settings?category=purchases', undefined, MGR)).body as any[];
  const cur = all.find((s) => s.key === 'purchase_order_terms');
  const body = { category: 'purchases', key: 'purchase_order_terms', value, description: 'Terms and conditions printed on the purchase order PDF, one per line' };
  return cur ? api.request('PUT', `/settings/${cur.id}`, body, MGR) : api.request('POST', '/settings', body, MGR);
};

test.describe('Purchase order PDF @p1', () => {
  test('POPDF-1 the PDF shows the order as it stands: the buyer from the business, the edited quantities, a status mark on a draft @happy', async ({ api }) => {
    const o = await order(api, 2, 7);
    const lines = (await api.request('GET', `/purchaseorders/${o.id}`, undefined, MGR)).body.requests;
    expect((await api.request('PUT', `/purchaserequests/${lines[0].id}`, { orderedqty: 11 }, MGR)).status).toBeLessThan(300);   // 7 asked for, 11 ordered
    const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;

    const { buf, disposition } = await pdfOf(api, o.id);
    expect(disposition).toContain(`PO-${o.id}.pdf`);
    const [p1] = await pdfPages(buf);
    expect(p1).toContain('PURCHASE ORDER');
    expect(p1).toContain(`PO No. ${o.id}`);
    expect(p1).toContain('14 Feb 2030');                                                         // expected delivery, in the app's date style
    expect(p1).toContain(o.vendor.name);
    expect(p1).toContain(String(biz.legalname || biz.name));                                     // the buyer is the business, not a shop in the code
    expect(p1).not.toContain('Ramesh');
    expect(p1).toContain('DRAFT');                                                               // not sent yet
    expect(p1).toContain('Deliver to the back door');
    expect(p1).toContain('Total quantity 18');                                                   // 11 + 7, not 7 + 7
    expect(p1).toContain('Estimated value');
    expect(p1).toContain('Authorised signatory');
    expect(p1).toContain('Vendor acceptance');
    expect(p1).toMatch(/Page 1 of 1/);
  });

  test('POPDF-2 terms are the business\'s own when written, the standard ones when not @happy', async ({ api }) => {
    const o = await order(api, 1);
    try {
      expect((await setTerms(api, 'Payment within 15 days of invoice.\nGoods must carry at least 80% of shelf life.')).status).toBeLessThan(300);
      const [custom] = await pdfPages((await pdfOf(api, o.id)).buf);
      expect(custom).toContain('Payment within 15 days of invoice.');
      expect(custom).toContain('80% of shelf life');
      expect(custom).not.toContain('Please supply the above items');
    } finally {
      expect((await setTerms(api, '')).status).toBeLessThan(300);
    }
    const [standard] = await pdfPages((await pdfOf(api, o.id)).buf);
    expect(standard).toContain('Please supply the above items as per the agreed rates and schedule.');
    expect(standard).toContain('Invoice should quote this PO number for settlement.');
  });

  test('POPDF-3 an order with many items runs on to further pages, each with its table heading and page number @edge', async ({ api }) => {
    const o = await order(api, 45, 3);
    expect(o.picks.length).toBeGreaterThan(36);
    const pages = await pdfPages((await pdfOf(api, o.id)).buf);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, i) => {
      expect(p, `page ${i + 1}`).toContain(`Page ${i + 1} of ${pages.length}`);
      if (i > 0) expect(p, `page ${i + 1} repeats the heading`).toContain('EST. RATE');
    });
    const all = pages.join('\n');
    expect(all).toContain(o.picks[o.picks.length - 1].title.slice(0, 12));                          // the last item is on the page, not off the edge
    expect(all).toContain('Total quantity 135');
  });

  test('POPDF-4 a submitted order carries no draft mark; the rupee sign and the title print @happy', async ({ api }) => {
    const o = await order(api, 1, 4);
    await api.request('POST', `/purchaseorders/${o.id}/submit`, undefined, MGR);
    const status = (await api.request('GET', `/purchaseorders/${o.id}`, undefined, MGR)).body.status;
    test.skip(status !== 'SUBMITTED', 'this order needed approval');
    const [p1] = await pdfPages((await pdfOf(api, o.id)).buf);
    expect(p1).not.toContain('DRAFT');
    expect(p1).not.toContain('AWAITING APPROVAL');
    expect(p1).toContain('₹');
  });

  test('POPDF-5 the Purchase settings page edits the terms and the PDF follows @happy', async ({ app, api }) => {
    const o = await order(api, 1);
    const { page } = await app.open(MGR, '/secure/purchases/settings');
    try {
      await page.getByTestId('po-terms').fill('Terms written on the screen.\nSecond term.');
      await page.getByTestId('po-settings-save').click();
      await expect(page.getByTestId('po-settings-saved')).toBeVisible();
      const [p1] = await pdfPages((await pdfOf(api, o.id)).buf);
      expect(p1).toContain('Terms written on the screen.');
      expect(p1).toContain('Second term.');
    } finally {
      await setTerms(api, '');
    }
  });

  test('POPDF-6 the signature blocks at the foot are the business own when written (up to three), the standard two when not @happy', async ({ api }) => {
    const o = await order(api, 1);
    const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
    try {
      expect((await setSetting(api, 'purchase_order_signatures', 'Prepared by | Purchase clerk\nChecked by | Store manager\nApproved by | Director | For {business}')).status).toBeLessThan(300);
      const [p1] = await pdfPages((await pdfOf(api, o.id)).buf);
      expect(p1).toContain('Prepared by');
      expect(p1).toContain('Purchase clerk');
      expect(p1).toContain('Checked by');
      expect(p1).toContain('Approved by');
      expect(p1).toContain(`For ${biz.legalname || biz.name}`);                                   // {business} filled in
      expect(p1).not.toContain('Vendor acceptance');                                             // only what was written
    } finally {
      await setSetting(api, 'purchase_order_signatures', '');
    }
    const [std] = await pdfPages((await pdfOf(api, o.id)).buf);
    expect(std).toContain('Authorised signatory');
    expect(std).toContain('Vendor acceptance');
    expect(std).toContain('Signature, seal and date');
  });

  test('POPDF-7 the settings page edits the signature blocks and refuses more than three @edge', async ({ app, api }) => {
    const o = await order(api, 1);
    const { page } = await app.open(MGR, '/secure/purchases/settings');
    try {
      await page.getByTestId('po-signatures').fill('A\nB\nC\nD');
      await expect(page.getByTestId('po-settings-save')).toBeDisabled();
      await page.getByTestId('po-signatures').fill('Buyer sign\nSeller sign | Stamp here');
      await page.getByTestId('po-settings-save').click();
      await expect(page.getByTestId('po-settings-saved')).toBeVisible();
      const [p1] = await pdfPages((await pdfOf(api, o.id)).buf);
      expect(p1).toContain('Buyer sign');
      expect(p1).toContain('Seller sign');
      expect(p1).toContain('Stamp here');
    } finally {
      await setSetting(api, 'purchase_order_signatures', '');
    }
  });
});
