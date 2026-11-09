/**
 * Saving a new customer from the billing screen - POSCUST-1..4
 * A customer typed at the counter (a mobile and a name, or a name and a location) can be saved on the spot with "Save customer", so the bill is for a
 * customer on record: Pay later, a prescription to follow and the customer's history all need one. Saving is optional: the bill still saves a new
 * customer as it always did. Uses real typing and clicks.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';                 // Sales Staff, store 1; the staff selector is set to its own user (id 3)
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };
const mobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
const run = Date.now().toString().slice(-7);


/** a fresh H1 product with one received, verified batch, so the counter can sell it (as the prescription specs do) */
async function h1Drug(api: any, tag: string) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-PSC-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA PSCDRUG ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `PS${tag}`, pack: 1, props: { schedule: 'H1' } }, MGR);
  const total = 50 * 70;
  const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total, batch: `PS-${tag}`, expdate: '2028-12-31' }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  const priced = await api.request('POST', '/products/prices/add', { productid: prod.body.id, saleprice: 100, reason: 'Market' }, MGR);
  expect(priced.status, JSON.stringify(priced.body)).toBeLessThan(300);
  return { title: `QA PSCDRUG ${tag}` };
}

/** the drug on the bill with its units typed, so the scheduled-drugs panel opens */
async function addDrug(page: any, title: string) {
  await page.locator('[data-testid=sale-add-item] input').first().fill(title);
  await page.locator('.p-autocomplete-panel li').filter({ hasText: title }).first().click();
  const units = page.getByTestId('sale-line').first().locator('input[aria-label="Units"]');
  await expect(units).toBeVisible();
  await units.fill('2');
  await units.press('Tab');
  await expect(page.getByTestId('sd-panel')).toBeVisible();
}

async function setting(api: any, key: string, value: string) {
  const s = (await api.request('GET', `/settings?key=${key}`, undefined, MGR)).body[0];
  expect(s, `the setting ${key} exists`).toBeTruthy();
  expect((await api.request('PUT', `/settings/${s.id}`, { value }, MGR)).status).toBeLessThan(300);
}

/** the scheduled-drugs panel (H1, H, X) shows on the bill once the shop asks for the register; put back after */
async function holdBack(api: any, on: boolean) {
  await setting(api, 'schedule_register_required', on ? 'H1,H,X' : '');
  await setting(api, 'schedule_register_enforce', on ? 'yes' : 'no');
}

const byMobile = async (api: any, m: string) =>
  (await api.request('POST', '/customers/filter', { condition: 'any', criteria: [{ property: 'mobile', check: 'startswith', value: m }] }, MGR)).body as any[];

test.describe('Save a new customer at the counter @p1', () => {
  test('POSCUST-1 a mobile and a name can be saved at once, and the bill is then for a customer on record @happy', async ({ app, api }) => {
    const m = mobile();
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('app-customer-select input').first().pressSequentially(m);
    const save = page.getByTestId('sale-cust-save');
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();                                     // no name yet
    await page.getByTestId('sale-cust-name').fill(`QA Save ${run}`);
    await expect(save).toBeEnabled();
    await save.click();

    // the typed fields give way to the customer on record
    await expect(page.getByTestId('sale-cust-name')).toHaveCount(0);
    await expect(page.getByText(`QA Save ${run}`)).toBeVisible();
    await expect(page.getByText(m)).toBeVisible();
    await expect(page.getByTestId('sale-cust-save')).toHaveCount(0);
    // and it really is on record
    const found = await byMobile(api, m);
    expect(found.length).toBe(1);
    expect(found[0].name).toBe(`QA Save ${run}`);
  });

  test('POSCUST-2 the button waits for a mobile of ten digits and a name of three letters @edge', async ({ app }) => {
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    const box = page.locator('app-customer-select input').first();
    await box.pressSequentially('98765');
    await expect(page.getByTestId('sale-cust-save')).toHaveCount(0);       // the name fields are not out yet
    await box.pressSequentially('43210');
    await expect(page.getByTestId('sale-cust-save')).toBeDisabled();
    await page.getByTestId('sale-cust-name').fill('ab');
    await expect(page.getByTestId('sale-cust-save')).toBeDisabled();
    await page.getByTestId('sale-cust-name').fill('abc');
    await expect(page.getByTestId('sale-cust-save')).toBeEnabled();
  });

  test('POSCUST-3 a customer with no mobile is saved with a name and a location, and a second one at the same place is refused with the reason @edge', async ({ app, api }) => {
    const place = `QA Place ${run}`;
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.getByTestId('sale-no-mobile').click();
    const save = page.getByTestId('sale-cust-save');
    await expect(save).toBeDisabled();
    await page.getByTestId('sale-cust-name').fill(`QA Nomob ${run}`);
    await expect(save).toBeDisabled();                                     // the location is needed too
    await page.getByTestId('sale-cust-locality').fill(place);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText(`QA Nomob ${run}`)).toBeVisible();
    await expect(page.getByText('no mobile')).toBeVisible();
    const rows = (await api.request('POST', '/customers/filter', { condition: 'any', criteria: [{ property: 'name', check: 'startswith', value: `QA Nomob ${run}` }] }, MGR)).body as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].locality).toBe(place);

    // the same name at the same place again: not added twice; the screen says why, and the typed fields stay
    await page.getByTitle('Choose another customer').click();
    await page.getByTestId('sale-no-mobile').click();
    await page.getByTestId('sale-cust-name').fill(`QA Nomob ${run}`);
    await page.getByTestId('sale-cust-locality').fill(place);
    await page.getByTestId('sale-cust-save').click();
    await expect(page.getByTestId('sale-cust-error')).toContainText('already exists');
    await expect(page.getByTestId('sale-cust-name')).toHaveValue(`QA Nomob ${run}`);
    const again = (await api.request('POST', '/customers/filter', { condition: 'any', criteria: [{ property: 'name', check: 'startswith', value: `QA Nomob ${run}` }] }, MGR)).body as any[];
    expect(again.length).toBe(1);
  });

  test('POSCUST-4 the button is optional: a typed customer stays unsaved until it is pressed, with nothing shown as wrong @edge', async ({ app, api }) => {
    const m = mobile();
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('app-customer-select input').first().pressSequentially(m);
    await page.getByTestId('sale-cust-name').fill(`QA Bill ${run}`);
    // the button is there but not pressed: the customer is not on record yet
    await expect(page.getByTestId('sale-cust-save')).toBeEnabled();
    await expect(page.getByTestId('sale-cust-error')).toHaveCount(0);
    expect((await byMobile(api, m)).length).toBe(0);                       // not saved until the bill (or the button)
  });

  test('POSCUST-5 the "not on record" warning on a scheduled-drug bill goes once the customer is saved @happy', async ({ app, api }) => {
    await holdBack(api, true);
    try {
    const drug = await h1Drug(api, `${run}`);
    const m = mobile();
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('app-customer-select input').first().pressSequentially(m);
    await page.getByTestId('sale-cust-name').fill(`QA Warn ${run}`);
    await addDrug(page, drug.title);
    // typed but not saved: the prescription panel says the customer is not on record
    await expect(page.getByTestId('sd-walkin')).toContainText('not on record');
    await expect(page.getByTestId('sd-patient-src')).toContainText('the bill');
    await page.getByTestId('sd-rx-open').click();
    await expect(page.getByTestId('sd-rx-form')).toContainText('this bill only');             // no customer on record to keep a prescription with
    // save the customer: both notes go, and a prescription can now be kept with their record
    await page.getByTestId('sale-cust-save').click();
    await expect(page.getByText(`QA Warn ${run}`).first()).toBeVisible();
    await expect(page.getByTestId('sd-walkin')).toHaveCount(0);
    await expect(page.getByTestId('sd-rx-form')).not.toContainText('this bill only');
    } finally { await holdBack(api, false); }
  });
});
