/**
 * A request for a product that is not in the product list - UNL-1..4
 * The counter types the name; purchasing sees it flagged, links it to a product (or creates one), and only then can it be ordered.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const uniq = () => `Zzqx Tonic ${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

test.describe('Requests for products not in the list @p1', () => {
  test('UNL-1 a request can carry a typed name instead of a product, shows in the list, and cannot be ordered until linked @happy', async ({ api }) => {
    const name = uniq();
    const made = await api.request('POST', '/purchaserequests', { requestedname: name, qty: 4, source: 'Customer', requesttype: 'Ad Hoc', priority: 'Normal', status: 'Open', customername: 'QA Unlisted' }, COUNTER);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);

    const list = (await api.request('GET', '/purchaserequests', undefined, MGR)).body as any[];
    const row = list.find((r) => r.requestedname === name);
    expect(row, 'the request is listed even though it has no product').toBeTruthy();
    expect(row.product).toBeNull();
    expect(row.productid).toBeNull();

    // neither a product nor a name: refused
    const none = await api.request('POST', '/purchaserequests', { qty: 1, source: 'Customer' }, COUNTER);
    expect(none.status).toBe(400);
    expect(JSON.stringify(none.body)).toContain('Choose the product');

    // not orderable while it has no product
    const early = await api.request('PUT', `/purchaserequests/${row.id}`, { status: 'Ordered', orderid: 1 }, MGR);
    expect(early.status).toBe(400);
    expect(JSON.stringify(early.body)).toContain('not in the product list');

    // linked to a product: the name is no longer needed, and it moves on like any request
    const product = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body[0];
    expect((await api.request('PUT', `/purchaserequests/${row.id}`, { productid: product.id }, MGR)).status).toBeLessThan(300);
    const after = (await api.request('GET', `/purchaserequests/${row.id}`, undefined, MGR)).body;
    expect(after.product?.id).toBe(product.id);
    expect((await api.request('PUT', `/purchaserequests/${row.id}`, { status: 'Reviewed' }, MGR)).status).toBeLessThan(300);

    // a product, as before, still works; a typed name is ignored when a product is given
    const withProduct = await api.request('POST', '/purchaserequests', { productid: product.id, requestedname: 'ignored', qty: 2, source: 'Customer' }, COUNTER);
    expect(withProduct.status).toBeLessThan(300);
    expect(withProduct.body.requestedname ?? null).toBeNull();
  });

  test('UNL-2 on the bill: type the name when the product is not in the list; matching products are offered first @happy', async ({ app, api }) => {
    const known = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body[0];
    const name = uniq();
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new');
    await page.getByTestId('pos-request-product').click();
    const dlg = page.getByTestId('pos-request-dialog');
    await expect(dlg).toBeVisible();

    await page.getByTestId('pos-request-unlisted').click();
    await page.getByTestId('pos-request-save').click();
    await expect(page.getByTestId('pos-request-error')).toContainText('Type the product name');

    await page.getByTestId('pos-request-name').fill(String(known.title).slice(0, 6));
    await expect(page.getByTestId('pos-request-match').first()).toBeVisible();                  // "Is it one of these?"
    await page.getByTestId('pos-request-name').fill(name);
    await expect(page.getByTestId('pos-request-matches')).toHaveCount(0);                       // nothing like it in the list

    await page.getByTestId('pos-request-qty').fill('2');
    await page.getByTestId('pos-request-cname').fill('QA Unlisted Customer');
    await page.getByTestId('pos-request-save').click();
    await expect(page.getByTestId('pos-request-done')).toBeVisible();

    const mine = (await api.request('GET', '/purchaserequests', undefined, MGR)).body as any[];
    expect(mine.find((r) => r.requestedname === name)).toMatchObject({ qty: 2, source: 'Customer', customername: 'QA Unlisted Customer', product: null });
  });

  test('UNL-3 purchasing sees it flagged, links it to a product, or creates the product from it @happy', async ({ app, api }) => {
    const product = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body[0];
    const nameA = uniq();
    const nameB = uniq();
    for (const n of [nameA, nameB]) {
      expect((await api.request('POST', '/purchaserequests', { requestedname: n, qty: 3, source: 'Customer', status: 'Open' }, COUNTER)).status).toBeLessThan(300);
    }
    const { page } = await app.open(MGR, '/secure/purchases/requests');
    const rowA = page.locator('tr', { hasText: nameA });
    await expect(rowA.getByTestId('req-unlisted')).toBeVisible();

    // link it to a product from the list
    await rowA.getByTestId('req-link').click();
    const dlg = page.getByTestId('req-link-dialog');
    await expect(dlg).toBeVisible();
    await page.getByTestId('req-link-save').click();
    await expect(dlg).toContainText('Choose the product');
    await dlg.locator('app-product-select input').fill(String(product.title).slice(0, 5));
    await page.locator('.p-autocomplete-panel li').first().click();
    await expect(page.getByTestId('req-link-chosen')).toBeVisible();
    await page.getByTestId('req-link-save').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('tr', { hasText: nameA })).toHaveCount(0);                      // now listed under its product's name
    const linked = ((await api.request('GET', '/purchaserequests', undefined, MGR)).body as any[]).find((r) => r.requestedname === nameA);
    expect(linked.productid).toBeTruthy();

    // or create the product from the request: the name comes over, and saving links the request to the new product
    await page.locator('tr', { hasText: nameB }).getByTestId('req-link').click();
    await page.getByTestId('req-create-product').click();
    await expect(page).toHaveURL(/products\/master\/new\?.*title=/);
    expect(await page.locator('form app-lookup input').evaluateAll((els) => els.map((e: any) => e.value))).toContainEqual(expect.stringMatching(new RegExp(nameB, 'i')));      // the name came over
    await page.locator('form select').first().selectOption('Medicine');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/purchases\/requests/);
    await expect.poll(async () => ((await api.request('GET', '/purchaserequests', undefined, MGR)).body as any[]).find((r) => r.requestedname === nameB)?.productid ?? null).not.toBeNull();
  });

  test('UNL-4 the Add Request form defaults to Staff and Refill, asks for the customer only for a customer request, has one notes box, and a typed request edits as its typed name @happy', async ({ app, api }) => {
    const name = uniq();
    expect((await api.request('POST', '/purchaserequests', { requestedname: name, qty: 2, source: 'Customer', customername: 'QA Edit', comments: 'the strip of 10' }, COUNTER)).status).toBeLessThan(300);
    const { page } = await app.open(MGR, '/secure/purchases/requests');
    await page.getByTestId('req-add').click();
    const dlg = page.locator('.p-dialog');
    await expect(dlg.locator('select[formcontrolname=source]')).toHaveValue('Staff');
    await expect(dlg.locator('select[formcontrolname=requesttype]')).toHaveValue('Refill');
    await expect(page.getByTestId('req-cname')).toHaveCount(0);                              // not a customer's request: no customer fields
    await expect(dlg.getByText('Notes', { exact: true })).toHaveCount(1);                    // one notes box, not comments and notes
    await expect(dlg.getByText('Comments', { exact: true })).toHaveCount(0);
    await dlg.locator('select[formcontrolname=source]').selectOption('Customer');
    await expect(page.getByTestId('req-cname')).toBeVisible();
    await expect(page.getByTestId('req-cphone')).toBeVisible();
    await dlg.locator('.p-dialog-header-close').click();

    // a request typed for a product not in the list opens as that name, with no product search showing a product
    await page.locator('tr', { hasText: name }).getByTitle('Edit').click();
    await expect(page.getByTestId('req-requestedname')).toHaveValue(name);
    await expect(page.getByTestId('req-notes')).toHaveValue('the strip of 10');
    await expect(dlg.locator('app-product-select')).toHaveCount(0);
    await expect(page.getByTestId('req-product-name')).toHaveCount(0);
    await expect(page.getByTestId('req-cname')).toHaveValue('QA Edit');                      // it is a customer's, so the customer shows
    await page.getByTestId('req-search-list').click();                                       // and it can be switched to a product from the list
    await expect(dlg.locator('app-product-select')).toBeVisible();
  });

  test('PUR-NAV the Purchase menu opens on Orders, whose pages read Requests, Reorder, Orders and open on Requests @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/purchases');
    await expect(page).toHaveURL(/\/secure\/purchases\/orders/);
    const tabs = page.locator('.p-tabview-nav').first().locator('li');
    expect((await tabs.allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual(['Requests', 'Reorder', 'Orders']);
    await expect(page.locator('.p-tabview-nav').first().locator('li.p-highlight')).toHaveText(/Requests/);
  });

  test('PUR-LINK a PO number opens the order from whichever Orders page you are on, never the login page @happy', async ({ app, api }) => {
    const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
    const po = await api.request('POST', '/purchaseorders', { vendorid: v.id }, MGR);
    expect(po.status).toBeLessThan(300);
    for (const start of ['/secure/purchases/orders', '/secure/purchases/requests', '/secure/purchases/suggestions']) {
      const { page } = await app.open(MGR, start);
      await page.getByRole('tab', { name: 'Orders' }).click();
      await page.getByTestId('po-link').first().click();
      await expect(page, `from ${start}`).toHaveURL(/\/secure\/purchases\/orders\/\d+/);
      await expect(page).not.toHaveURL(/login/);
    }
  });
});
