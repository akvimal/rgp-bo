/**
 * Prescription upload on the billing screen (pharmacy pack) — PRX-1..3
 * A bill with a Schedule H1, H or X drug shows the scheduled-drugs panel. From it the cashier uploads a picture of the prescription:
 * it needs the file, the patient, the doctor and the patient's mobile; it is kept with the customer (when they are on record) and
 * attached to the bill; the bill then completes and the drug register line says "Prescription attached".
 * Until now only the API calls behind the button were covered (customer-history, documents, files); this clicks the button.
 * PRX-4 and PRX-5 cover copying the patient and the doctor from what is already on record: chips, where a value came from, Undo, and a
 * prescription that is never taken for another patient.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';                 // Sales Staff, store 1; the staff selector is set to its own user (id 3)
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const run = Date.now().toString().slice(-7);
const mobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };

/** a fresh H1 product with one received, verified batch, so the counter can sell it */
async function h1Drug(api: any, tag: string) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-PRX-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA PRXDRUG ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `PX${tag}`, pack: 1, props: { schedule: 'H1' } }, MGR);
  const total = 50 * 70;
  const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total, batch: `PX-${tag}`, expdate: '2028-06-30' }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  // a new batch has no selling price until one is set: without it the line is Rs 0 and the bill cannot be completed
  const priced = await api.request('POST', '/products/prices/add', { productid: prod.body.id, saleprice: 100, reason: 'Market' }, MGR);
  expect(priced.status, JSON.stringify(priced.body)).toBeLessThan(300);
  return { productid: prod.body.id as number, itemid: it.body.id as number, batch: `PX-${tag}`, title: `QA PRXDRUG ${tag}` };
}

async function setting(api: any, key: string, value: string) {
  const s = (await api.request('GET', `/settings?key=${key}`, undefined, MGR)).body[0];
  expect(s, `the setting ${key} exists`).toBeTruthy();
  expect((await api.request('PUT', `/settings/${s.id}`, { value }, MGR)).status).toBeLessThan(300);
}

/** H1 (and H, X) need the patient and the prescriber, and the bill is held back until they are given */
async function holdBack(api: any, on: boolean) {
  await setting(api, 'schedule_register_required', on ? 'H1,H,X' : '');
  await setting(api, 'schedule_register_enforce', on ? 'yes' : 'no');
}

async function customerOnRecord(api: any) {
  const m = mobile();
  const c = await api.request('POST', '/customers', { name: `QA PRX CUSTOMER ${Date.now()}`, mobile: m, srctype: 'Walkin', address: '1 Customer Street, Anytown' }, MGR);
  expect(c.status).toBeLessThan(300);
  return { id: c.body.id as number, name: c.body.name as string, mobile: m };
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


/** an earlier supply on the customer's record: who the patient and the doctor were */
async function earlierSupply(api: any, drug: any, customerid: number, detail: any) {
  const now = new Date().toISOString();
  const r = await api.request('POST', '/sales', {
    customerid, billdate: now, orderdate: now, cashamt: 100, digiamt: 0, total: 100, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: drug.itemid, productid: drug.productid, batch: drug.batch, price: 100, mrpcost: 100, taxpcnt: 12, qty: 1, total: 100, status: 'Complete' }],
    props: { scheduledetail: detail },
  }, COUNTER);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
}

/** a prescription kept with the customer, for a named patient */
async function prescriptionOnFile(api: any, customerid: number, patient: string, doctor: string) {
  const token = await api.token(MGR);
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' }), 'rx.png');
  const up = await (await fetch(`${process.env.QA_API_URL}/files/upload?customer=${customerid}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd })).json();
  const props = [{ id: 'prescdate', label: 'Date', value: new Date().toISOString().slice(0, 10) }, { id: 'doctorname', label: 'Doctor Name', value: doctor }, { id: 'ptntname', label: 'Patient Name', value: patient }];
  const doc = await api.request('POST', '/documents', { name: 'rx.png', path: up.path, extn: 'png', category: 'Prescription', alias: `${doctor} prescription`, docprops: JSON.stringify(props), uploadprops: JSON.stringify(up) }, MGR);
  expect(doc.status, JSON.stringify(doc.body)).toBeLessThan(300);
  expect((await api.request('POST', '/customers/documents/add', { customerId: customerid, documentId: doc.body.id }, MGR)).status).toBeLessThan(300);
  return doc.body.id as number;
}

/** open a bill for a customer on record with the drug on it and the panel showing */
async function billFor(app: any, c: { mobile: string }, drug: any) {
  const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
  // the page is still loading the saved bills when it opens, and can empty the box: type again until the customer is offered
  const offered = page.locator('.p-autocomplete-panel li').filter({ hasText: c.mobile });
  await expect(async () => {
    await page.locator('app-customer-select input').first().fill(c.mobile);
    await expect(offered.first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await offered.first().click();
  const history = page.locator('.p-dialog');
  await history.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
  if (await history.count()) { await page.keyboard.press('Escape'); await expect(history).toHaveCount(0); }
  await addDrug(page, drug.title);
  return page;
}

test.describe('Prescription upload on the bill @p1', () => {
  test.beforeEach(async ({ api }) => { await holdBack(api, true); });
  test.afterEach(async ({ api }) => { await holdBack(api, false); });

  test('PRX-1 the prescription is uploaded from the bill, kept with the customer and attached; the bill completes and the register says so @happy', async ({ app, api }) => {
    const drug = await h1Drug(api, `a-${run}`);
    const c = await customerOnRecord(api);
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);

    await page.locator('app-customer-select input').first().fill(c.mobile);
    await page.locator('.p-autocomplete-panel li').filter({ hasText: c.mobile }).first().click();
    // picking a customer on record opens their history over the bill: close it
    const history = page.locator('.p-dialog');
    await history.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
    if (await history.count()) { await page.keyboard.press('Escape'); await expect(history).toHaveCount(0); }
    await addDrug(page, drug.title);

    // held back until the register has what it needs
    await expect(page.getByTestId('sale-complete')).toBeDisabled();
    await page.getByTestId('sd-prescriber-name').fill(`DR UI ${run}`);
    await page.getByTestId('sd-prescriber-reg').fill(`TN${run}`);
    await page.getByTestId('sd-patient-address').fill('12 Main Road, Anytown');

    // the upload form: the customer's mobile is offered, and it says what is still missing
    await page.getByTestId('sd-rx-open').click();
    await expect(page.getByTestId('sd-rx-form')).toBeVisible();
    await expect(page.getByTestId('sd-rx-patient-mobile')).toHaveValue(c.mobile);
    await expect(page.getByTestId('sd-rx-save')).toBeDisabled();
    await expect(page.getByTestId('sd-rx-needs')).toContainText('the picture or PDF');
    await page.getByTestId('sd-rx-file').setInputFiles({ name: 'rx.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await expect(page.getByTestId('sd-rx-save')).toBeEnabled();
    await page.getByTestId('sd-rx-save').click();

    await expect(page.getByTestId('sd-rx-done')).toContainText('attached to this bill');
    await expect(page.getByTestId('sd-rx-done')).toContainText(c.name);                  // kept with this customer
    await expect(page.getByTestId('sd-rx-doc')).toHaveCount(1);
    await expect(page.getByTestId('sd-basis-attached')).toBeVisible();
    await expect(page.getByTestId('sale-document')).toHaveCount(1);                       // on the bill with its other documents
    await expect(page.getByTestId('sale-complete')).toBeEnabled();

    const posted = page.waitForResponse((r) => r.url().endsWith('/sales') && r.request().method() === 'POST');
    await page.getByTestId('sale-complete').click();
    const res = await posted;
    expect(res.status(), await res.text()).toBeLessThan(300);

    // kept with the customer
    const docs = (await api.request('GET', `/customers/${c.id}/documents`, undefined, MGR)).body as any[];
    const rx = docs.filter((d) => String(d.category).toLowerCase() === 'prescription');
    expect(rx).toHaveLength(1);
    expect(rx[0].alias).toContain(`DR UI ${run}`);
    // the register line carries it
    const rows = (await api.request('GET', '/schedule/register?from=2020-01-01&to=2099-12-31', undefined, MGR)).body.rows as any[];
    const mine = rows.filter((r) => r.drug_name === drug.title);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ schedule: 'H1', prescriber_name: `DR UI ${run}`, rx_label: 'Prescription attached', superseded: false });
  });

  test('PRX-2 the Upload button asks for the file, the doctor and the patient mobile, says which is missing, and Cancel closes the form @edge', async ({ app, api }) => {
    const drug = await h1Drug(api, `b-${run}`);
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('app-customer-select input').first().pressSequentially(mobile());     // a customer not on record
    await page.getByTestId('sale-cust-name').fill('QA PRX WALKIN');
    await addDrug(page, drug.title);

    await page.getByTestId('sd-rx-open').click();
    const save = page.getByTestId('sd-rx-save');
    const needs = page.getByTestId('sd-rx-needs');
    await expect(save).toBeDisabled();
    await expect(needs).toContainText('the picture or PDF');
    await expect(needs).toContainText("the doctor's name");                                  // the doctor is entered above, not in the form
    await page.getByTestId('sd-prescriber-name').fill(`DR NEEDS ${run}`);
    await expect(needs).not.toContainText("the doctor's name");
    await page.getByTestId('sd-rx-patient-mobile').fill('12345');                             // too short
    await expect(needs).toContainText('10-digit mobile');
    await page.getByTestId('sd-rx-patient-mobile').fill(mobile());
    await page.getByTestId('sd-rx-doctor-phone').fill('123');                                 // optional, but when given it must be 10 digits
    await expect(needs).toContainText('10-digit doctor phone');
    await page.getByTestId('sd-rx-doctor-phone').fill('');
    await page.getByTestId('sd-rx-file').setInputFiles({ name: 'rx.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await expect(save).toBeEnabled();

    await page.getByTestId('sd-rx-cancel').click();
    await expect(page.getByTestId('sd-rx-form')).toHaveCount(0);
    await expect(page.getByTestId('sd-rx-doc')).toHaveCount(0);                              // nothing was uploaded
    await expect(page.getByTestId('sale-complete')).toBeDisabled();                           // and the bill is still held back
  });

  test('PRX-3 a Counter login can upload too, and for a customer not on record the prescription stays with the bill only @edge', async ({ app, api }) => {
    const drug = await h1Drug(api, `c-${run}`);
    const roles = (await api.request('GET', '/roles', undefined, MGR)).body as any[];
    const counter = roles.find((r) => r.name === 'Counter');
    test.skip(!counter, 'no Counter role');
    const stores = (await api.request('GET', '/stores', undefined, MGR)).body;
    const email = `qa.prx.${Date.now()}@local.test`;
    const made = await api.request('POST', '/users', { fullname: 'QA PRX Counter', email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid: counter.id, storeids: [stores[0].id] }, MGR);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);

    const m = mobile();
    const { page } = await app.open(email, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.locator('app-customer-select input').first().pressSequentially(m);
    await page.getByTestId('sale-cust-name').fill('QA PRX WALKIN');
    await addDrug(page, drug.title);
    await expect(page.getByTestId('sd-walkin')).toContainText('not on record');                // nothing to copy: no chips, the name is from the bill
    await expect(page.getByTestId('sd-patient-chips')).toHaveCount(0);
    await expect(page.getByTestId('sd-patient-src')).toContainText('the bill');
    await page.getByTestId('sd-prescriber-name').fill(`DR COUNTER ${run}`);
    await page.getByTestId('sd-prescriber-reg').fill(`TN${run}C`);
    await page.getByTestId('sd-patient-address').fill('5 Lake Road, Anytown');

    await page.getByTestId('sd-rx-open').click();
    await expect(page.getByTestId('sd-rx-form')).toContainText('this bill only');             // no customer on record to keep it with
    await page.getByTestId('sd-rx-patient-mobile').fill(m);
    await page.getByTestId('sd-rx-file').setInputFiles({ name: 'rx.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await page.getByTestId('sd-rx-save').click();
    await expect(page.getByTestId('sd-rx-done')).toContainText('Add the customer to keep it with their record');
    await expect(page.getByTestId('sd-basis-attached')).toBeVisible();
    await expect(page.getByTestId('sale-complete')).toBeEnabled();

    const posted = page.waitForResponse((r) => r.url().endsWith('/sales') && r.request().method() === 'POST');
    await page.getByTestId('sale-complete').click();
    expect((await posted).status()).toBeLessThan(300);
    const rows = (await api.request('GET', '/schedule/register?from=2020-01-01&to=2099-12-31', undefined, MGR)).body.rows as any[];
    const line = rows.find((r) => r.drug_name === drug.title);
    expect(line, 'the register line was written').toBeTruthy();
    expect(line.rx_label).toBe('Prescription attached');
  });
  test('PRX-4 chips copy the patient and the doctor one at a time, say where each came from, and Undo puts it back @happy', async ({ app, api }) => {
    const drug = await h1Drug(api, `d-${run}`);
    const c = await customerOnRecord(api);
    await earlierSupply(api, drug, c.id, { patient_name: 'MEENA KUMAR', patient_address: '12 Main Road, Anytown', patient_age: '67', prescriber_name: `DR RAO ${run}`, prescriber_reg_no: `TN${run}1`, prescriber_address: 'Rao Clinic' });
    await earlierSupply(api, drug, c.id, { patient_name: 'RAVI KUMAR', patient_address: '9 Lake Road, Anytown', patient_age: '42', prescriber_name: `DR ANITHA ${run}`, prescriber_reg_no: `TN${run}2`, prescriber_address: 'Anitha Clinic' });
    await earlierSupply(api, drug, c.id, { patient_name: c.name.toUpperCase(), patient_address: '1 Customer Street, Anytown', patient_age: '50', prescriber_name: `DR ANITHA ${run}`, prescriber_reg_no: `TN${run}2`, prescriber_address: 'Anitha Clinic' });
    const page = await billFor(app, c, drug);

    // the patient starts as the customer, from their record, and the chips offer the people on earlier supplies
    const name = page.getByTestId('sd-patient-name'), age = page.getByTestId('sd-patient-age'), addr = page.getByTestId('sd-patient-address');
    const asCustomer = new RegExp('^' + c.name + '$', 'i');                                      // the form shows the name in title case
    await expect(name).toHaveValue(asCustomer);
    await expect(page.getByTestId('sd-patient-src')).toContainText('the customer record');
    await expect(page.getByTestId('sd-patient-chip')).toHaveCount(3);                          // the customer, Meena and Ravi
    await expect(page.getByTestId('sd-patient-chip').first()).toContainText('Customer:');
    await expect(page.getByTestId('sd-prescriber-chip')).toHaveCount(2);

    // a patient chip fills the name, age and address, and says where from
    await page.getByTestId('sd-patient-chip').filter({ hasText: 'MEENA KUMAR' }).click();
    await expect(name).toHaveValue('MEENA KUMAR');
    await expect(age).toHaveValue('67');
    await expect(addr).toHaveValue('12 Main Road, Anytown');
    await expect(page.getByTestId('sd-patient-src')).toContainText('Copied from last supply');
    await page.getByTestId('sd-patient-undo').click();                                          // back to what was there
    await expect(name).toHaveValue(asCustomer);
    await expect(page.getByTestId('sd-patient-src')).toHaveCount(0);

    // the customer chip: the customer's own name, and the address and age an earlier supply to them recorded (the bill is not given the
    // address on the customer's record: it is masked there)
    await page.getByTestId('sd-patient-chip').first().click();
    await expect(name).toHaveValue(asCustomer);
    await expect(addr).toHaveValue('1 Customer Street, Anytown');
    await expect(age).toHaveValue('50');

    // typing over a copied value: it is no longer "from" anywhere
    await name.fill('SOMEBODY NEW');
    await expect(page.getByTestId('sd-patient-src')).toHaveCount(0);

    // a doctor chip fills the doctor only: the patient stays as it is
    await page.getByTestId('sd-prescriber-chip').filter({ hasText: `DR RAO ${run}` }).click();
    await expect(page.getByTestId('sd-prescriber-name')).toHaveValue(`DR RAO ${run}`);
    await expect(page.getByTestId('sd-prescriber-reg')).toHaveValue(`TN${run}1`);
    await expect(page.getByTestId('sd-prescriber-address')).toHaveValue('Rao Clinic');
    await expect(name).toHaveValue('SOMEBODY NEW');
    await expect(page.getByTestId('sd-prescriber-src')).toContainText('Copied from last supply');
    await page.getByTestId('sd-prescriber-undo').click();
    await expect(page.getByTestId('sd-prescriber-name')).toHaveValue('');

    // "Another doctor" clears the doctor and puts the cursor in the name
    await page.getByTestId('sd-prescriber-chip').first().click();
    await page.getByTestId('sd-prescriber-else').click();
    await expect(page.getByTestId('sd-prescriber-name')).toHaveValue('');
    await expect(page.getByTestId('sd-prescriber-name')).toBeFocused();
  });

  test('PRX-5 a prescription on file is never taken for another patient @edge', async ({ app, api }) => {
    const drug = await h1Drug(api, `e-${run}`);
    const c = await customerOnRecord(api);
    await earlierSupply(api, drug, c.id, { patient_name: 'MEENA KUMAR', patient_address: '12 Main Road, Anytown', patient_age: '67', prescriber_name: `DR RAO ${run}`, prescriber_reg_no: `TN${run}1`, prescriber_address: 'Rao Clinic' });
    await prescriptionOnFile(api, c.id, c.name.toUpperCase(), `DR RAO ${run}`);
    const page = await billFor(app, c, drug);

    // a patient chosen from the chips first: the prescription of the customer cannot be used for them
    await page.getByTestId('sd-patient-chip').filter({ hasText: 'MEENA KUMAR' }).click();
    await expect(page.getByTestId('sd-use-rx')).toBeDisabled();
    await expect(page.getByTestId('sd-rx-mismatch')).toContainText(new RegExp(c.name, 'i'));

    // the customer chosen again, the prescription is theirs: use it, then pick Meena, and it is let go with a warning
    await page.getByTestId('sd-patient-chip').first().click();
    await expect(page.getByTestId('sd-use-rx')).toBeEnabled();
    await page.getByTestId('sd-use-rx').first().click();
    await expect(page.getByTestId('sale-document')).toHaveCount(1);                              // attached to the bill
    await page.getByTestId('sd-patient-chip').filter({ hasText: 'MEENA KUMAR' }).click();
    await expect(page.getByTestId('sd-rx-let-go')).toContainText('not attached');
    await expect(page.getByTestId('sale-document')).toHaveCount(0);                              // and taken off the bill
    await expect(page.getByTestId('sd-basis-attached')).toHaveCount(0);
  });
});
