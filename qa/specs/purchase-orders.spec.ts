/**
 * Purchase Orders — PO-1..9
 * Source: docs/testing/manual-test-plan.html  (module "po")
 *
 * Line items on a PO are linked PurchaseRequest rows. The seed leaves 4 POs in
 * PENDING_APPROVAL (manifest.stats.pendingApprovalPOs) for the approval path.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';
const THRESHOLD_KEY = 'purchase_order_approval_value_threshold';

async function vendor(api: any) {
  return (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
}
// products that already have a ptr_cost (from a GRN) so the PO estimate is non-zero
let PRICED_PRODUCT_IDS: number[] = [];
async function pricedProducts(api: any): Promise<number[]> {
  if (PRICED_PRODUCT_IDS.length) return PRICED_PRODUCT_IDS;
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 60 }, MGR)).body;
  PRICED_PRODUCT_IDS = [...new Set(rows.filter((x: any) => x.status === 'VERIFIED').map((x: any) => x.id))] as number[];
  return PRICED_PRODUCT_IDS;
}
async function draftPO(api: any, opts: { qty?: number; lines?: number } = {}) {
  const v = await vendor(api);
  const prods = await pricedProducts(api);
  const po = await api.request('POST', '/purchaseorders', { vendorid: v, comments: 'qa PO spec' }, MGR);
  for (let i = 0; i < (opts.lines ?? 1); i++) {
    const pr = await api.request('POST', '/purchaserequests', { productid: prods[i % prods.length], qty: opts.qty ?? 10, vendorid: v }, MGR);
    await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  }
  return po.body.id;
}
async function setThreshold(api: any, value: number) {
  const s = (await api.request('GET', `/settings?key=${THRESHOLD_KEY}`, undefined, MGR)).body[0];
  await api.request('PUT', `/settings/${s.id}`, { value: String(value) }, MGR);
}

test.describe('Purchase Orders @p1', () => {
  test.afterEach(async ({ api }) => { await setThreshold(api, 5000); }); // never leak a mutated threshold

  test('PO-1 a draft PO is saved and not yet visible to approvers @happy', async ({ app, api }) => {
    const id = await draftPO(api, { lines: 2 });
    const po = await api.request('GET', `/purchaseorders/${id}`, undefined, MGR);
    expect(po.body.status).toBe('PENDING'); // draft
    const pendingList = await api.request('GET', '/purchaseorders?status=PENDING_APPROVAL', undefined, MGR);
    expect(pendingList.body.some((o: any) => o.id === id)).toBeFalsy();

    const { page } = await app.open(MGR, '/secure/purchases/orders');
    await expectShell(page);
    // Orders screen lands on the Reorder (suggestions) tab by default (PO revamp WS-3) - switch tabs to reach the list.
    await page.getByRole('tab', { name: 'Orders' }).click();
    await expect(page.getByTestId(TID.poCreate)).toBeVisible();
  });

  test('PO-2 submitting below the threshold auto-approves @happy', async ({ api }) => {
    await setThreshold(api, 100000);
    const id = await draftPO(api, { qty: 5 });
    await api.request('POST', `/purchaseorders/${id}/submit`, undefined, MGR);
    const po = await api.request('GET', `/purchaseorders/${id}`, undefined, MGR);
    expect(po.body.status).toBe('SUBMITTED');
    expect(po.body.approvalstatus).toBe('Approved');
  });

  test('PO-3 submitting above the threshold routes to PENDING_APPROVAL with a reason @edge', async ({ api }) => {
    await setThreshold(api, 1);
    const id = await draftPO(api, { qty: 200, lines: 2 });
    await api.request('POST', `/purchaseorders/${id}/submit`, undefined, MGR);
    const po = await api.request('GET', `/purchaseorders/${id}`, undefined, MGR);
    expect(po.body.status).toBe('PENDING_APPROVAL');
    expect(po.body.approvalstatus).toBe('Pending');
    // not usable for an invoice yet
    const inv = await api.request('POST', '/purchases', {
      vendorid: po.body.vendorid, purchaseorderid: String(id), invoiceno: `X-${id}`, invoicedate: '2026-09-04',
    }, MGR);
    expect(inv.status).toBeGreaterThanOrEqual(400);
    await setThreshold(api, 5000);
  });

  test('PO-4 approve is rejected for a role without the policy - API not just the button @permission', async ({ api }) => {
    const pending = (await api.request('GET', '/purchaseorders?status=PENDING_APPROVAL', undefined, MGR)).body[0];
    expect(pending).toBeTruthy();
    const bad = await api.request('POST', `/purchaseorders/${pending.id}/approve`, undefined, 'sales1@local.test');
    expect(bad.status).toBeGreaterThanOrEqual(403);
    // still pending
    const after = await api.request('GET', `/purchaseorders/${pending.id}`, undefined, MGR);
    expect(after.body.status).toBe('PENDING_APPROVAL');
  });

  test('PO-5 approving a pending PO records approver + timestamp @happy', async ({ app, api }) => {
    const pending = (await api.request('GET', '/purchaseorders?status=PENDING_APPROVAL', undefined, MGR)).body[0];
    const { page } = await app.open(MGR, `/secure/purchases/orders/${pending.id}`);
    await expectShell(page);
    await expect(page.getByTestId(TID.poDetail)).toHaveAttribute('data-po-status', 'PENDING_APPROVAL');
    await page.getByTestId(TID.poApprove).click();
    await expect(page.getByTestId(TID.poDetail)).toHaveAttribute('data-po-approval', 'Approved');
    const po = await api.request('GET', `/purchaseorders/${pending.id}`, undefined, MGR);
    expect(po.body.status).toBe('SUBMITTED');
    expect(po.body.approvedby ?? po.body.approved_by).toBeTruthy();
    expect(po.body.approvedat ?? po.body.approved_at).toBeTruthy();
  });

  test('PO-6 rejecting a pending PO stores the reason @happy', async ({ app, api }) => {
    const pending = (await api.request('GET', '/purchaseorders?status=PENDING_APPROVAL', undefined, MGR)).body[0];
    expect(pending, 'a pending PO to reject').toBeTruthy();
    const { page } = await app.open(MGR, `/secure/purchases/orders/${pending.id}`);
    await expectShell(page);
    await page.getByTestId(TID.poRejectOpen).click();
    await page.getByTestId(TID.poRejectReason).fill('QA reject - price too high');
    await page.getByTestId(TID.poRejectConfirm).click();
    await expect.poll(async () =>
      (await api.request('GET', `/purchaseorders/${pending.id}`, undefined, MGR)).body.status,
    ).toBe('REJECTED');
    const po = await api.request('GET', `/purchaseorders/${pending.id}`, undefined, MGR);
    expect(po.body.rejectionreason ?? po.body.rejection_reason).toContain('QA reject');
  });

  test('PO-7 submitting a PO with no line items is blocked (issue #135) @negative', async ({ api }) => {
    const v = await vendor(api);
    const po = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
    const submit = await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
    expect(submit.status).toBeGreaterThanOrEqual(400);
    const after = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
    expect(after.body.status).toBe('PENDING'); // still a draft
  });

  test('PO-8 a draft PO deletes; a SUBMITTED one does not (issue #136) @edge', async ({ api }) => {
    const draftId = await draftPO(api);
    const del = await api.request('DELETE', `/purchaseorders/${draftId}`, undefined, MGR);
    expect(del.status).toBeLessThan(400);

    await setThreshold(api, 100000);
    const submittedId = await draftPO(api, { qty: 3 });
    await api.request('POST', `/purchaseorders/${submittedId}/submit`, undefined, MGR);
    const delSub = await api.request('DELETE', `/purchaseorders/${submittedId}`, undefined, MGR);
    expect(delSub.status).toBeGreaterThanOrEqual(400); // blocked
    const stillThere = await api.request('GET', `/purchaseorders/${submittedId}`, undefined, MGR);
    expect(stillThere.body.status).toBe('SUBMITTED');
    await setThreshold(api, 5000);
  });

  test('PO-9 changing the threshold immediately governs the auto-approve boundary @integration', async ({ api }) => {
    await setThreshold(api, 1);
    const overId = await draftPO(api, { qty: 300, lines: 2 });
    await api.request('POST', `/purchaseorders/${overId}/submit`, undefined, MGR);
    expect((await api.request('GET', `/purchaseorders/${overId}`, undefined, MGR)).body.status).toBe('PENDING_APPROVAL');

    await setThreshold(api, 100000000);
    const underId = await draftPO(api, { qty: 300, lines: 2 });
    await api.request('POST', `/purchaseorders/${underId}/submit`, undefined, MGR);
    expect((await api.request('GET', `/purchaseorders/${underId}`, undefined, MGR)).body.approvalstatus).toBe('Approved');

    await setThreshold(api, 5000);
  });
});
