/**
 * The sensitive purchasing actions - RPU-1..5 (MENU_AND_PERMISSIONS step D, Purchasing).
 * Payments, vendor returns, completed invoices, approval for payment and recalculating totals are their own actions on the purchases permission.
 * A role holding only the everyday actions (read, add, edit, delete) cannot do them; the owner roles can by name.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only the Purchase page with these actions, and a login with it */
async function loginWith(api: any, actions: string[]) {
  const purchases = { resource: 'purchases', path: ['/secure/purchases'], policies: actions.map((action) => ({ action })) };
  const role = await api.request('POST', '/roles', { name: `QA Pur ${stamp()}`, permissions: [purchases], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rpu.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RPU', email, password: PASS, phone: '9000000011', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;
const EVERYDAY = ['read', 'add', 'edit', 'delete'];

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Purchasing actions @p1', () => {
  test('RPU-1 the everyday actions (read, add, edit, delete) open none of the sensitive ones @negative', async ({ api }) => {
    const email = await loginWith(api, EVERYDAY);
    expect(await status(api, 'GET', '/purchases/payables', email)).toBe(200);                               // reading still works
    expect(await status(api, 'GET', '/vendor-returns', email)).toBe(200);
    expect(await status(api, 'GET', '/vendorpayments/invoice/4001', email)).toBe(403);                     // payments.view
    expect(await status(api, 'POST', '/vendorpayments', email, {})).toBe(403);                              // payments.record
    expect(await status(api, 'POST', '/vendorpayments/batch', email, {})).toBe(403);
    expect(await status(api, 'PUT', '/vendorpayments/1', email, {})).toBe(403);
    expect(await status(api, 'POST', '/vendorpayments/1/reverse', email, {})).toBe(403);                   // payments.reverse
    expect(await status(api, 'POST', '/vendor-returns', email, {})).toBe(403);                              // returns.manage
    expect(await status(api, 'DELETE', '/vendor-returns/invoice/1/1', email)).toBe(403);
    expect(await status(api, 'GET', '/purchases/total-check', email)).toBe(403);                            // invoices.recalculate
    expect(await status(api, 'GET', '/purchases/line-check', email)).toBe(403);
    expect(await status(api, 'POST', '/purchases/total-fix', email, {})).toBe(403);
    expect(await status(api, 'POST', '/purchases/4001/approve', email, {})).toBe(403);                      // invoices.approvepay
    expect(await status(api, 'POST', '/purchases/4001/unapprove', email, {})).toBe(403);
    expect(await status(api, 'PUT', '/purchases/approval-settings', email, {})).toBe(403);
    expect(await status(api, 'DELETE', '/purchases/4001', email)).toBe(403);                                // a completed invoice: invoices.editcompleted
    expect((await api.request('GET', '/purchases/approval-settings', undefined, email)).body.canmanage).toBe(false);
  });

  test('RPU-2 payments: seeing, recording and reversing are three separate actions @permission', async ({ api }) => {
    const viewer = await loginWith(api, ['read', 'payments.view']);
    expect(await status(api, 'GET', '/vendorpayments/invoice/4001', viewer)).toBe(200);
    expect(await status(api, 'POST', '/vendorpayments', viewer, {})).toBe(403);
    const clerk = await loginWith(api, ['read', 'add', 'edit', 'payments.view', 'payments.record']);
    expect(await status(api, 'POST', '/vendorpayments', clerk, {})).not.toBe(403);                         // allowed to try; the empty payment is a 400
    expect(await status(api, 'PUT', '/vendorpayments/999999', clerk, {})).not.toBe(403);
    expect(await status(api, 'POST', '/vendorpayments/999999/reverse', clerk, {})).toBe(403);             // recording is not reversing
    const reverser = await loginWith(api, ['read', 'payments.reverse']);
    expect(await status(api, 'POST', '/vendorpayments/999999/reverse', reverser, {})).not.toBe(403);
    expect(await status(api, 'POST', '/vendorpayments', reverser, {})).toBe(403);
  });

  test('RPU-3 vendor returns need returns.manage to change anything @permission', async ({ api }) => {
    const none = await loginWith(api, ['read', 'add']);
    expect(await status(api, 'POST', '/vendor-returns', none, {})).toBe(403);
    const manager = await loginWith(api, ['read', 'returns.manage']);
    expect(await status(api, 'POST', '/vendor-returns', manager, {})).not.toBe(403);                       // allowed to try; the empty return is a 400
    expect(await status(api, 'GET', '/vendor-returns', manager)).toBe(200);
  });

  test('RPU-4 approving for payment, recalculating totals and changing a completed invoice are their own actions @permission', async ({ api }) => {
    const approver = await loginWith(api, ['read', 'add', 'invoices.approvepay']);
    expect(await status(api, 'POST', '/purchases/999999/approve', approver, {})).not.toBe(403);          // allowed to try; the invoice is not found
    expect((await api.request('GET', '/purchases/approval-settings', undefined, approver)).body.canmanage).toBe(true);
    expect(await status(api, 'GET', '/purchases/total-check', approver)).toBe(403);
    const checker = await loginWith(api, ['read', 'invoices.recalculate']);
    expect(await status(api, 'GET', '/purchases/total-check', checker)).toBe(200);
    expect(await status(api, 'GET', '/purchases/line-check', checker)).toBe(200);
    expect(await status(api, 'POST', '/purchases/999999/approve', checker, {})).toBe(403);
    const editor = await loginWith(api, ['read', 'delete', 'invoices.editcompleted']);
    // the guard lets a delete through (the role holds delete); only the completed-invoice rule is in question, so use an invoice that does not exist
    expect(await status(api, 'DELETE', '/purchases/999999', editor)).not.toBe(403);
  });

  test('RPU-5 the owner roles keep every sensitive action by name @permission', async ({ api }) => {
    expect(await status(api, 'GET', '/purchases/total-check', MGR)).toBe(200);
    expect(await status(api, 'GET', '/vendorpayments/invoice/4001', MGR)).toBe(200);
    expect((await api.request('GET', '/purchases/approval-settings', undefined, MGR)).body.canmanage).toBe(true);
    expect(await status(api, 'POST', '/vendorpayments/999999/reverse', MGR, {})).not.toBe(403);
    // the seeded Purchase Staff role can record payments and returns (it could before) but not reverse one
    expect(await status(api, 'POST', '/vendorpayments/999999/reverse', 'storehead@local.test', {})).not.toBe(403);   // the Store Head holds reverse
  });
});
