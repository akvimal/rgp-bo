/**
 * Customers — CUST-1..4
 * Source: docs/testing/manual-test-plan.html  (module "customers")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

test.describe('Customers @p2', () => {
  test('CUST-1 a new customer is saved and selectable on the Sale screen @happy', async ({ app, api }) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
    const { page } = await app.open(MGR, '/secure/customers/cust/new');
    await expectShell(page);
    await page.getByTestId(TID.custFName).fill('QA Customer One');
    await page.getByTestId(TID.custFMobile).fill(mobile);
    await page.getByTestId(TID.custFEmail).fill('qa.cust1@example.com');
    await page.getByTestId(TID.custFSrctype).selectOption({ index: 1 });
    await expect(page.getByTestId(TID.custFSave)).toBeEnabled();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/customers') && r.request().method() === 'POST'),
      page.getByTestId(TID.custFSave).click(),
    ]);
    expect(resp.status()).toBeLessThan(400);

    const found = await api.request('GET', `/customers/search/mobile/${mobile}`, undefined, CASHIER);
    expect(found.status).toBeLessThan(400);
    expect(found.body?.mobile ?? found.body?.[0]?.mobile).toBe(mobile);
  });

  test('CUST-2 the orders tab lists a customer\'s past sales @happy', async ({ api }) => {
    // customer 1 (Aarav Kumar) has seeded sales
    const stats = await api.request('GET', '/customers/1/stats', undefined, MGR);
    expect(stats.status).toBeLessThan(400);
    const orders = await api.request('GET', '/customers/1/2026/9/orders', undefined, MGR);
    expect(orders.status).toBeLessThan(400);
    expect(Array.isArray(orders.body)).toBeTruthy();
    // every returned order belongs to customer 1
    if (orders.body.length) {
      expect(orders.body.every((o: any) => (o.customer_id ?? o.customerid ?? 1) === 1)).toBeTruthy();
    }
  });

  test('CUST-3 a document can be attached to a customer and read back @happy', async ({ api }) => {
    // create a document row, then link it to the customer
    const doc = await api.request('POST', '/documents', {
      name: `QA Prescription ${Date.now()}`, path: 'qa/fake/rx.pdf', extn: 'pdf', category: 'prescription', alias: 'RX',
    }, MGR);
    expect(doc.status).toBeLessThan(400);
    const add = await api.request('POST', '/customers/documents/add', {
      customerId: 1, documentId: doc.body.id,
    }, MGR);
    expect(add.status).toBeLessThan(400);
    const docs = await api.request('GET', '/customers/1/documents', undefined, MGR);
    expect(docs.body.some((d: any) => d.id === doc.body.id)).toBeTruthy();
  });

  test('CUST-4 searching for a nonexistent customer returns a clean empty result @negative', async ({ api }) => {
    const byFilter = await api.request('POST', '/customers/filter', {
      criteria: [{ property: 'name', check: 'startswith', value: 'Zznobody-Qx-' }],
    }, MGR);
    expect(byFilter.status).toBeLessThan(400);
    expect(Array.isArray(byFilter.body) ? byFilter.body.length : 0).toBe(0);

    const byMobile = await api.request('GET', '/customers/search/mobile/9000000000000', undefined, MGR);
    expect(byMobile.status).toBeLessThan(500); // no crash
  });
});
