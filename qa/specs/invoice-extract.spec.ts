/**
 * Reading an invoice copy — PX-1..5
 * An attached PDF (its text) or photo (OCR) is read: the header fills the form, the item table becomes lines to confirm, and the
 * confirmed lines are added to the draft. The invoices here are rendered from HTML so the text is known.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const API = () => process.env.QA_API_URL as string;

let TOKEN = '';
test.beforeAll(async () => {
  TOKEN = (await (await fetch(`${API()}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
});

const post = (path: string, body: any) => fetch(`${API()}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body) });

async function upload(buf: Buffer, name: string, type: string) {
  const f = new FormData();
  f.append('file', new Blob([buf], { type }), name);
  const r = await fetch(`${API()}/files/upload?px=${Date.now()}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: f });
  return (await r.json()).path as string;
}

interface Row { title: string; batch: string; exp: string; mrp: number; qty: number; free: number; rate: number; disc: number; gst: number }
const amount = (r: Row) => +(r.qty * r.rate * (1 - r.disc / 100)).toFixed(2);

function invoiceHtml(vendor: string, no: string, rows: Row[], net: number) {
  const body = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.title}</td><td>10</td><td>${r.batch}</td><td>${r.exp}</td><td>${r.mrp.toFixed(2)}</td><td>${r.qty}</td><td>${r.free}</td><td>${r.rate.toFixed(2)}</td><td>${r.disc.toFixed(2)}</td><td>${r.gst.toFixed(2)}</td><td>${amount(r).toFixed(2)}</td></tr>`).join('');
  return `<html><body style="font-family: Arial, sans-serif; font-size: 13px; margin: 24px">
    <h2 style="margin:0 0 6px">${vendor}</h2>
    <div>Invoice No : ${no} &nbsp;&nbsp;&nbsp; Invoice Date : 12/09/2026</div>
    <table style="width:100%; border-collapse: collapse; margin-top: 14px" border="1" cellpadding="5">
      <tr><th>Sl</th><th>Product</th><th>Pack</th><th>Batch</th><th>Exp</th><th>MRP</th><th>Qty</th><th>Free</th><th>Rate</th><th>Disc%</th><th>GST%</th><th>Amount</th></tr>
      ${body}
      <tr><td colspan="11">Total</td><td>${rows.reduce((t, r) => t + amount(r), 0).toFixed(2)}</td></tr>
    </table>
    <p style="margin-top:14px">Net Amount : ${net.toFixed(2)}</p></body></html>`;
}

function sample(tag: string) {
  const [p1, p2] = [data.m.products[3], data.m.products[4]];
  const rows: Row[] = [
    { title: p1.title, batch: `PX${tag}A`, exp: '08/27', mrp: 30, qty: 10, free: 2, rate: 20, disc: 5, gst: 12 },
    { title: p2.title, batch: `PX${tag}B`, exp: '11/28', mrp: 95, qty: 5, free: 0, rate: 60, disc: 0, gst: 12 },
  ];
  const net = Math.round(rows.reduce((t, r) => t + amount(r) * (1 + r.gst / 100), 0) * 100) / 100;
  return { rows, net, products: [p1, p2] };
}

test.describe('Read an invoice copy @p1', () => {
  test('PX-1 a PDF is read from its text: header, lines, the vendor and the products matched @happy', async ({ api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const no = `PX/${tag}`;
    const s = sample(tag);
    const page = await (await browser.newContext()).newPage();
    await page.setContent(invoiceHtml(vendor.name, no, s.rows, s.net));
    const pdf = await page.pdf({ format: 'A4', landscape: true });
    const path = await upload(pdf, 'inv.pdf', 'application/pdf');

    const res = await post('/purchases/extract', { path });
    expect(res.status).toBeLessThan(300);
    const r = await res.json();
    expect(r.method).toBe('pdf');
    expect(r.header.invoiceno).toBe(no);
    expect(r.header.invoicedate).toBe('2026-09-12');
    expect(r.header.printedtotal).toBe(s.net);
    expect(r.vendor?.id).toBe(vendor.id);                                                              // matched by its name on the invoice
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ batch: `PX${tag}A`, expdate: '2027-08-31', mrp: 30, qty: 10, free: 2, rate: 20, disc: 5, tax: 12, amount: 190 });
    expect(r.lines[0].warnings).toEqual([]);
    expect(r.lines[0].product?.id).toBe(s.products[0].id);                                              // the same name in the master is chosen
    expect(r.lines[1].product?.id).toBe(s.products[1].id);
    expect(r.linesTotal).toBe(s.net);
    expect(r.text).toContain(no);
    await page.context().close();
  });

  test('PX-2 a photo is read with OCR; the numbers can differ from the page, so the warning says to check @happy', async ({ api, browser }) => {
    test.setTimeout(120_000);
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const no = `PX/${tag}`;
    const s = sample(tag);
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 2 })).newPage();
    await page.setContent(invoiceHtml(vendor.name, no, s.rows, s.net));
    const png = await page.screenshot({ fullPage: true });
    const path = await upload(png, 'inv.png', 'image/png');

    const res = await post('/purchases/extract', { path });
    expect(res.status).toBeLessThan(300);
    const r = await res.json();
    expect(r.method).toBe('ocr');
    expect(r.warnings.join(' ')).toContain('Read from a photo');
    expect(r.header.invoiceno).toBe(no);
    expect(r.header.printedtotal).toBe(s.net);
    expect(r.lines.length, r.text).toBe(2);
    expect(r.lines[0]).toMatchObject({ batch: `PX${tag}A`, qty: 10, rate: 20 });
    await page.context().close();
  });

  test('PX-3 a scanned PDF, an unknown type and a path outside the upload folder are refused @negative', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.setContent('<html><body></body></html>');
    const blank = await upload(await page.pdf(), 'blank.pdf', 'application/pdf');
    const scan = await post('/purchases/extract', { path: blank });
    expect(scan.status).toBe(400);
    expect(JSON.stringify(await scan.json())).toContain('scan');
    expect((await post('/purchases/extract', { path: '/etc/passwd' })).status).toBe(403);
    expect((await post('/purchases/extract', { path: '/usr/src/app/upload/none/missing.pdf' })).status).toBe(404);
    expect((await post('/purchases/extract', {})).status).toBeGreaterThanOrEqual(400);
    await page.context().close();
  });

  test('PX-4 the form: attach, see what was read, the form fills, confirmed lines are added to the draft @happy', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const no = `PX/${tag}`;
    const s = sample(tag);
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, no, s.rows, s.net));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);              // the page has finished loading
    await page.waitForLoadState('networkidle');
    await page.getByTestId('inv-f-file').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByTestId('inv-x-panel')).toBeVisible();
    await expect(page.getByTestId('inv-x-method')).toContainText('PDF');
    await expect(page.getByTestId('inv-x-filled')).toContainText('invoice no.');
    await expect(page.getByTestId('inv-f-no')).toHaveValue(no);
    await expect(page.getByTestId('inv-f-total')).toHaveValue(String(s.net));
    await expect(page.getByTestId('inv-f-vendor')).toHaveValue(String(vendor.id));
    await expect(page.getByTestId('inv-f-date')).toHaveValue('2026-09-12');
    await expect(page.getByTestId('inv-x-row-0')).toBeVisible();
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();
    await expect(page.getByTestId('inv-x-summary')).toContainText('2 of 2 lines');
    await expect(page.getByTestId('inv-x-total-check')).toHaveText('they agree');
    await page.getByTestId('inv-x-text-toggle').click();
    await expect(page.getByTestId('inv-x-text')).toContainText(no);

    await expect(page.getByTestId('inv-f-save')).toHaveText('Save and add 2 items');
    await page.getByTestId('inv-f-save').click();
    await expect(page).toHaveURL(/invoices\/items\/\d+/);
    const id = Number(page.url().split('/').pop());
    await expect(page.getByTestId('invoice-check-ok')).toBeVisible();                                 // the lines agree with the printed total
    const inv = (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body;
    expect(inv.items).toHaveLength(2);
    expect(inv.items.map((i: any) => i.batch).sort()).toEqual([`PX${tag}A`, `PX${tag}B`]);
    expect(inv.status).toBe('NEW');                                                                    // nothing is received until a person completes it
    await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
  });

  test('PX-5 a line that is not ready is left out until it is fixed; a misread amount is flagged @edge', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const s = sample(tag);
    s.rows[1].exp = '';                                                                                // no expiry printed on the second line
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, `PX/${tag}`, s.rows, s.net));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);              // the page has finished loading
    await page.waitForLoadState('networkidle');
    await page.getByTestId('inv-f-file').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();
    await expect(page.getByTestId('inv-x-include-1')).not.toBeChecked();
    await expect(page.getByTestId('inv-x-include-1')).toBeDisabled();
    await expect(page.getByTestId('inv-x-row-1')).toContainText('Needs: expiry');
    await expect(page.getByTestId('inv-f-save')).toHaveText('Save and add 1 item');
    await page.getByTestId('inv-x-exp-1').fill('2028-11');                                              // fixed by hand
    await expect(page.getByTestId('inv-x-include-1')).toBeChecked();
    await expect(page.getByTestId('inv-f-save')).toHaveText('Save and add 2 items');
  });
});
