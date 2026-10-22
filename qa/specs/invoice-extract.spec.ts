/**
 * Reading an invoice copy — PX-1..12
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

function invoiceHtml(vendor: string, no: string, rows: Row[], net: number, footer = '') {
  const body = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.title}</td><td>10</td><td>${r.batch}</td><td>${r.exp}</td><td>${r.mrp.toFixed(2)}</td><td>${r.qty}</td><td>${r.free}</td><td>${r.rate.toFixed(2)}</td><td>${r.disc.toFixed(2)}</td><td>${r.gst.toFixed(2)}</td><td>${amount(r).toFixed(2)}</td></tr>`).join('');
  return `<html><body style="font-family: Arial, sans-serif; font-size: 13px; margin: 24px">
    <h2 style="margin:0 0 6px">${vendor}</h2>
    <div>Invoice No : ${no} &nbsp;&nbsp;&nbsp; Invoice Date : 12/09/2026</div>
    <table style="width:100%; border-collapse: collapse; margin-top: 14px" border="1" cellpadding="5">
      <tr><th>Sl</th><th>Product</th><th>Pack</th><th>Batch</th><th>Exp</th><th>MRP</th><th>Qty</th><th>Free</th><th>Rate</th><th>Disc%</th><th>GST%</th><th>Amount</th></tr>
      ${body}
      <tr><td colspan="11">Total</td><td>${rows.reduce((t, r) => t + amount(r), 0).toFixed(2)}</td></tr>
    </table>
    ${footer}
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

/** three made-up words: no product, from this run or an earlier one, shares a word with it, so it is never suggested */
function unusualName() {
  const word = () => Array.from({ length: 7 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('');
  return `${word()} ${word()} ${word()}`;
}

/** attach the invoice copy; if the page was still settling and dropped the file, attach it again */
async function attach(page: any, pdf: Buffer) {
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('inv-f-file').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: pdf });
    try { await page.getByTestId('inv-x-row-0').waitFor({ timeout: 8000 }); return; } catch { /* try again */ }
  }
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
    expect(r.lines[0]).toMatchObject({ batch: `PX${tag}A`, expdate: '2027-08-01', mrp: 30, qty: 10, free: 2, rate: 20, disc: 5, tax: 12, amount: 190 });
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
    await attach(page, pdf);
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
    await attach(page, pdf);
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();
    await expect(page.getByTestId('inv-x-include-1')).not.toBeChecked();
    await expect(page.getByTestId('inv-x-include-1')).toBeDisabled();
    await expect(page.getByTestId('inv-x-row-1')).toContainText('Needs: expiry');
    await expect(page.getByTestId('inv-f-save')).toHaveText('Save and add 1 item');
    await page.getByTestId('inv-x-exp-1').fill('11/28');                                                // fixed by hand
    await expect(page.getByTestId('inv-x-include-1')).toBeChecked();
    await expect(page.getByTestId('inv-f-save')).toHaveText('Save and add 2 items');
  });

  test('PX-6 a line for a product with no expiry is ready without one @edge', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const blade = (await api.request('POST', '/products', { title: `QA BLADE PX${tag}`, taxpcnt: 12, pack: 1, category: 'OTC', code: `PXB${tag}`, props: { subcategory: 'Surgical', noexpiry: true } }, MGR)).body;
    const rows: Row[] = [{ title: blade.title, batch: `PX${tag}A`, exp: '', mrp: 15, qty: 20, free: 0, rate: 10, disc: 0, gst: 12 }];
    const net = Math.round(amount(rows[0]) * 1.12 * 100) / 100;
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, `PX/${tag}`, rows, net));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await attach(page, pdf);
    await expect(page.getByTestId('inv-x-row-0')).toBeVisible();
    await expect(page.getByTestId('inv-x-noexp-0')).toBeVisible();                                      // "no expiry"
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();
    await expect(page.getByTestId('inv-x-row-0')).not.toContainText('Needs');
    await page.getByTestId('inv-f-save').click();
    await expect(page).toHaveURL(/invoices\/items\/\d+/);
    const id = Number(page.url().split('/').pop());
    const inv = (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body;
    expect(inv.items).toHaveLength(1);
    expect(inv.items[0].expdate ?? null).toBeNull();
    await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
  });

  test('PX-7 the product search starts from the name read, can be left for the suggestions, and points to adding a missing product @happy', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const partial = data.m.products[3].title.replace(/\s*\[.*\]\s*$/, '');                              // the name without its brand code: suggested, not chosen for the person
    const unknown = unusualName();                                                                         // not in the system at all, and sharing no word with anything that is
    const rows: Row[] = [
      { title: partial, batch: `PX${tag}A`, exp: '08/27', mrp: 30, qty: 10, free: 0, rate: 20, disc: 0, gst: 12 },
      { title: unknown, batch: `PX${tag}B`, exp: '11/28', mrp: 95, qty: 5, free: 0, rate: 60, disc: 0, gst: 12 },
    ];
    const net = Math.round(rows.reduce((t, r) => t + amount(r) * 1.12, 0) * 100) / 100;
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, `PX/${tag}`, rows, net));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await attach(page, pdf);
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();

    // a product that is not in the system: the search opens with the name read, and says where to add it
    const input1 = page.locator('[data-testid="inv-x-row-1"] app-product-select input');
    await expect(input1).toHaveValue(unknown);
    await expect(page.getByTestId('inv-x-new-1')).toBeVisible();                                           // a dialog, not a new tab (a new tab would be signed out)
    await expect(page.getByTestId('inv-x-back-1')).toHaveCount(0);                                         // there are no suggestions to go back to

    // a product with suggestions: "other product" starts from the name read; going back restores the suggestions
    await expect(page.getByTestId('inv-x-product-0')).toBeVisible();
    await page.getByTestId('inv-x-other-0').click();
    const input0 = page.locator('[data-testid="inv-x-row-0"] app-product-select input');
    await expect(input0).toHaveValue(partial);
    await expect(page.locator('.p-autocomplete-item').first()).toContainText(partial.split(' ')[0]);      // the matches are listed straight away
    await page.getByTestId('inv-x-back-0').click();
    await expect(page.getByTestId('inv-x-product-0')).toBeVisible();
    await expect(page.getByTestId('inv-x-include-0')).not.toBeChecked();                                  // nothing was chosen by leaving the search

    // choose from the search, then go back: a choice that is not one of the suggestions is dropped
    await page.getByTestId('inv-x-other-0').click();
    await page.locator('.p-autocomplete-item').first().click();
    await expect(page.getByTestId('inv-x-product-0')).toBeVisible();                                     // it is one of the suggestions, so the list shows it chosen
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();

    // a product that is not a suggestion stays shown as chosen, and going back drops it
    await page.getByTestId('inv-x-other-0').click();
    await page.locator('[data-testid="inv-x-row-0"] app-product-select input').fill('Insulin');
    await page.locator('.p-autocomplete-item', { hasText: 'Insulin' }).first().click();
    await expect(page.getByTestId('inv-x-chosen-0')).toBeVisible();
    await page.getByTestId('inv-x-back-0').click();
    await expect(page.getByTestId('inv-x-include-0')).not.toBeChecked();
  });

  test('PX-8 a product that is missing is added from the line in a dialog and chosen for it @happy', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const title = unusualName();
    const rows: Row[] = [{ title, batch: `PX${tag}B`, exp: '11/28', mrp: 15, qty: 100, free: 0, rate: 10, disc: 0, gst: 12 }];
    const net = Math.round(amount(rows[0]) * 1.12 * 100) / 100;
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, `PX/${tag}`, rows, net));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await attach(page, pdf);
    await expect(page.getByTestId('inv-x-row-0')).toBeVisible();
    await expect(page.getByTestId('inv-x-include-0')).not.toBeChecked();

    await page.getByTestId('inv-x-new-0').click();
    await expect(page.getByTestId('inv-np-title')).toHaveValue(title);                                     // the name read
    await expect(page.getByTestId('inv-np-tax')).toHaveValue('12');                                        // and the GST read
    await page.getByTestId('inv-np-title').fill('');
    await page.getByTestId('inv-np-save').click();
    await expect(page.getByTestId('inv-np-error')).toContainText('name');
    await page.getByTestId('inv-np-title').fill(title);
    await page.getByTestId('inv-np-category').selectOption('Medicine');
    await page.getByTestId('inv-np-save').click();
    await expect(page.getByTestId('inv-np-error')).toContainText('schedule');                              // a medicine needs its schedule
    await page.getByTestId('inv-np-category').selectOption('OTC');
    await page.getByTestId('inv-np-noexpiry').check();
    await page.getByTestId('inv-np-save').click();

    await expect(page.getByTestId('inv-np')).toHaveCount(0);                                              // the dialog closes
    await expect(page.getByTestId('inv-x-chosen-0')).toContainText(title);
    await expect(page.getByTestId('inv-x-noexp-0')).toBeVisible();                                        // the product never expires: no expiry needed
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();
    const made = (await api.request('POST', '/products/filter', { condition: 'any', criteria: [{ property: 'title', check: 'startswith', value: title }] }, MGR)).body;
    expect(made).toHaveLength(1);
    expect(made[0].taxpcnt ?? made[0].tax_pcnt).toBe(12);

    await page.getByTestId('inv-f-save').click();                                                         // the line is added to the draft with the new product
    await expect(page).toHaveURL(/invoices\/items\/\d+/);
    const id = Number(page.url().split('/').pop());
    const inv = (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body;
    expect(inv.items).toHaveLength(1);
    expect(inv.items[0].productid).toBe(made[0].id);
    expect(inv.items[0].expdate ?? null).toBeNull();
    await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
  });

  test('PX-9 a 3 MB invoice copy attaches and is read; one over the limit says it is too large @edge', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const s = sample(tag);
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, `PX/${tag}`, s.rows, s.net));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();
    const pad = (mb: number) => Buffer.concat([pdf, Buffer.from('\n%' + 'x'.repeat(mb * 1024 * 1024))]);        // a PDF with comment padding after its end

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await attach(page, pad(3));                                                                         // the web server used to refuse anything over 1 MB
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();
    await expect(page.getByTestId('inv-f-error')).toHaveCount(0);

    await page.getByTestId('inv-f-file').setInputFiles({ name: 'huge.pdf', mimeType: 'application/pdf', buffer: pad(11) });
    await expect(page.getByTestId('inv-f-error')).toContainText('too large');
  });

  test('PX-10 a scanned PDF (a picture with no text) is read as a picture; the invoice is the same as a PDF with text @happy', async ({ api, browser }) => {
    test.setTimeout(120_000);
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const no = `PX/${tag}`;
    const s = sample(tag);
    const shot = await (await browser.newContext({ viewport: { width: 1280, height: 500 }, deviceScaleFactor: 2 })).newPage();
    await shot.setContent(invoiceHtml(vendor.name, no, s.rows, s.net));
    const png = await shot.screenshot({ fullPage: true });
    await shot.context().close();
    const doc = await (await browser.newContext()).newPage();                                              // a PDF that holds only the picture: no text layer
    await doc.setContent(`<html><body style="margin:0"><img style="width:100%" src="data:image/png;base64,${png.toString('base64')}"></body></html>`);
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();
    const path = await upload(pdf, 'scan.pdf', 'application/pdf');

    const res = await post('/purchases/extract', { path });
    expect(res.status).toBeLessThan(300);
    const r = await res.json();
    expect(r.method).toBe('pdf-ocr');
    expect(r.warnings.join(' ')).toContain('scan');
    expect(r.header.invoiceno).toBe(no);
    expect(r.header.printedtotal).toBe(s.net);
    expect(r.lines.length).toBe(2);
    expect(r.lines[0]).toMatchObject({ batch: `PX${tag}A`, qty: 10, rate: 20 });
  });

  test('PX-11 a cash discount at the foot is read, kept with the invoice, and the lines are checked after it @happy', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const no = `PX/${tag}`;
    const s = sample(tag);
    const goods = s.rows.reduce((t, r) => t + amount(r), 0);
    const cd = Math.round(goods * 0.04 * 100) / 100;
    const net = Math.round(s.rows.reduce((t, r) => t + amount(r) * (1 + r.gst / 100), 0) * ((goods - cd) / goods) * 100) / 100;
    const footer = `<p>Goods Value ${goods.toFixed(2)}</p><p>Less CD 4.00 % ${cd.toFixed(2)}</p>`;
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, no, s.rows, net, footer).replace(`Net Amount : ${net.toFixed(2)}`, `Invoice Amt. ${net.toFixed(2)}`));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const path = await upload(pdf, 'cd.pdf', 'application/pdf');
    const r = await (await post('/purchases/extract', { path })).json();
    expect(r.header.cashdiscount).toEqual({ pct: 4, amount: cd });
    expect(r.header.goodsvalue).toBe(+goods.toFixed(2));
    expect(r.header.printedtotal).toBe(net);                                                                // read from "Invoice Amt."
    expect(Math.abs(r.linesTotal - net)).toBeLessThan(1);                                                   // after the discount the lines agree

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await attach(page, pdf);
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();
    await expect(page.getByTestId('inv-f-cd')).toHaveValue(String(cd));                                     // filled in under More details
    await expect(page.getByTestId('inv-x-cd')).toBeVisible();
    await expect(page.getByTestId('inv-x-total-check')).toHaveText('they agree');
    await page.getByTestId('inv-f-save').click();
    await expect(page).toHaveURL(/invoices\/items\/\d+/);
    const id = Number(page.url().split('/').pop());
    expect((await api.request('GET', `/purchases/${id}`, undefined, MGR)).body.cashdiscount).toBe(cd);
    await expect(page.getByTestId('invoice-check-ok')).toBeVisible();                                        // the invoice page agrees too
    await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
  });

  test('PX-12 the grid: only the configured GST rates, a discount of at most 100, MM/YY expiry, wide MRP and rate and narrow batch and expiry @edge', async ({ app, api, browser }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
    const tag = String(Date.now()).slice(-5);
    const [p1, p2] = [data.m.products[3], data.m.products[4]];
    const rows: Row[] = [
      { title: p1.title, batch: `PX${tag}A`, exp: '08/27', mrp: 30, qty: 10, free: 0, rate: 20, disc: 0, gst: 28 },     // 28 is not one of the offered rates
      { title: p2.title, batch: `PX${tag}B`, exp: '11/28', mrp: 95, qty: 5, free: 0, rate: 60, disc: 0, gst: 12 },
    ];
    const doc = await (await browser.newContext()).newPage();
    await doc.setContent(invoiceHtml(vendor.name, `PX/${tag}`, rows, 700));
    const pdf = await doc.pdf({ format: 'A4', landscape: true });
    await doc.context().close();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-vendor').locator('option')).not.toHaveCount(1);
    await page.waitForLoadState('networkidle');
    await attach(page, pdf);
    await expect(page.getByTestId('inv-x-row-1')).toBeVisible();

    // GST: the choices are the configured rates (0, 5, 12, 18); a rate read that is not one of them is left for the person to choose
    const options = await page.getByTestId('inv-x-tax-0').locator('option').allTextContents();
    expect(options.map((o) => o.trim())).toEqual(['GST?', '0%', '5%', '12%', '18%']);
    await expect(page.getByTestId('inv-x-row-0')).toContainText('Needs: GST rate');
    await expect(page.getByTestId('inv-x-include-0')).toBeDisabled();
    await expect(page.getByTestId('inv-x-tax-1')).toHaveValue(/12/);                                        // a rate that is offered is kept
    await page.getByTestId('inv-x-tax-0').selectOption({ label: '18%' });
    await expect(page.getByTestId('inv-x-row-0')).not.toContainText('Needs');
    await expect(page.getByTestId('inv-x-include-0')).toBeChecked();

    // discount: a percentage, at most 100
    await page.getByTestId('inv-x-disc-0').fill('150');
    await expect(page.getByTestId('inv-x-disc-0')).toHaveValue('100');
    await page.getByTestId('inv-x-disc-0').fill('12.5');
    await expect(page.getByTestId('inv-x-disc-0')).toHaveValue('12.5');

    // expiry: typed as month and year
    await page.getByTestId('inv-x-exp-1').fill('13/28');                                                    // there is no month 13
    await expect(page.getByTestId('inv-x-row-1')).toContainText('Needs: expiry');
    await page.getByTestId('inv-x-exp-1').fill('9/29');
    await expect(page.getByTestId('inv-x-row-1')).not.toContainText('Needs');

    // all the columns fit the card on a desktop screen without sideways scrolling
    await page.setViewportSize({ width: 1366, height: 900 });
    const scrolls = await page.getByTestId('inv-x-lines').evaluate((el: HTMLElement) => el.scrollWidth - el.clientWidth);
    expect(scrolls).toBeLessThanOrEqual(2);

    // widths: MRP and rate wider than batch and expiry
    const w = async (id: string) => (await page.getByTestId(id).boundingBox())!.width;
    expect(await w('inv-x-mrp-0')).toBeGreaterThan(await w('inv-x-exp-0'));
    expect(await w('inv-x-rate-0')).toBeGreaterThan(await w('inv-x-batch-0'));
    expect(await w('inv-x-mrp-0')).toBeGreaterThanOrEqual(90);
    expect(await w('inv-x-exp-0')).toBeLessThanOrEqual(80);
    expect(await w('inv-x-batch-0')).toBeLessThanOrEqual(90);

    // each box fills its column: no empty space beside it (the box is as wide as its heading's column, less the cell padding)
    for (const [box, head] of [['inv-x-mrp-0', 'MRP'], ['inv-x-qty-0', 'Qty'], ['inv-x-rate-0', 'Rate'], ['inv-x-disc-0', 'Disc %'], ['inv-x-tax-0', 'Tax %']] as const) {
      const b = (await page.getByTestId(box).boundingBox())!;
      const h = (await page.locator('[data-testid="inv-x-lines"] th', { hasText: head }).first().boundingBox())!;
      expect(h.width - b.width, `${head}: space left beside the box`).toBeLessThanOrEqual(14);
    }
  });
});
