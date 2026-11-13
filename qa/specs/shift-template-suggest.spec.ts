/**
 * Shift templates fit the time of day — SHIFTT-1..3
 * Source: the shift opened from the header (the shift desk) has no template picker, and people do not open at the planned time.
 * The template whose window is nearest to now (within 2 hours) is offered and picked; the times are a plan, so a shift with no template has no planned times.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', { location: `ShiftT ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
}
/** India time as the server reads it, plus or minus some minutes, as "HH:MM" */
function ist(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
const tpl = (api: any, storeid: number, name: string, starttime: string, endtime: string) =>
  api.request('POST', '/store-cash/templates', { storeid, name, starttime, endtime, depositthreshold: 0, active: true }, MGR);
/** opens a shift; when the "do this to continue" gate asks for a reason on something left undone, one is given (the dev data may hold old unclosed shifts) */
async function openShift(api: any, body: Record<string, any>) {
  const first = await api.request('POST', '/store-cash/shifts', body, MGR);
  if (first.status !== 409 || !Array.isArray(first.body?.required)) return first;
  const compliancereasons = Object.fromEntries(first.body.required.map((r: any) => [r.id, 'qa spec: left for later']));
  return api.request('POST', '/store-cash/shifts', { ...body, compliancereasons }, MGR);
}
const suggest = async (api: any, storeid: number) => (await api.request('GET', `/store-cash/templates/suggest?storeid=${storeid}`, undefined, MGR)).body;

test.describe('Shift templates and the time of day @p1', () => {
  test('SHIFTT-1 the template that fits now is suggested; one far from now is still offered, marked as not close; a store with none gets nothing @happy', async ({ api }) => {
    const sid = await freshStore(api);
    expect((await suggest(api, sid)).template).toBeNull();                                          // no templates

    const near = (await tpl(api, sid, 'QA Near', ist(-30), ist(+30))).body;
    const far = (await tpl(api, sid, 'QA Far', ist(+300), ist(+420))).body;                         // starts 5 hours from now
    const s = await suggest(api, sid);
    expect(s.template.id).toBe(near.id);
    expect(s.within).toBe(true);
    expect(s.tolerance).toBe(120);

    // only the distant one is left: it is still offered, but not as a fit
    await api.request('PUT', `/store-cash/templates/${near.id}`, { active: false }, MGR);
    const only = await suggest(api, sid);
    expect(only.template.id).toBe(far.id);
    expect(only.within).toBe(false);
  });

  test('SHIFTT-2 opened a little after the planned start still fits within two hours; a shift with no template has no planned times @edge', async ({ api }) => {
    const sid = await freshStore(api);
    const late = (await tpl(api, sid, 'QA Late', ist(-100), ist(+200))).body;                       // began 100 minutes ago: now is inside it
    expect((await suggest(api, sid)).template.id).toBe(late.id);

    const withTpl = await openShift(api, { storeid: sid, templateid: late.id, openingcash: 0, allowZero: true });
    expect(withTpl.status, JSON.stringify(withTpl.body)).toBeLessThan(300);
    expect(withTpl.body.name).toBe('QA Late');
    expect(withTpl.body.starttime).toBe(late.starttime);                                           // the plan comes from the template
    await api.request('PUT', `/store-cash/shifts/${withTpl.body.id}/close`, { cashvariancereason: 'qa variance', counteddenominations: [], allowZero: true }, MGR);

    const sid2 = await freshStore(api);
    const bare = await openShift(api, { storeid: sid2, openingcash: 0, allowZero: true });
    expect(bare.status, JSON.stringify(bare.body)).toBeLessThan(300);
    expect(bare.body.starttime).toBe('');                                                          // not an invented 09:00
    expect(bare.body.endtime).toBe('');
    expect(bare.body.openedon ?? bare.body.opened_on).toBeTruthy();                                // the real moment is what is recorded
    await api.request('PUT', `/store-cash/shifts/${bare.body.id}/close`, { cashvariancereason: 'qa variance', counteddenominations: [], allowZero: true }, MGR);
  });

  test('SHIFTT-3 the shift desk offers the shift that fits, picked for the person, and says the times are a plan @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/shift', { operatorId: 3, operatorName: 'Sale Staff One' });
    const templates = [
      { id: 71, name: 'Morning', starttime: '09:00', endtime: '14:00', active: true },
      { id: 72, name: 'Evening', starttime: '14:00', endtime: '22:00', active: true },
    ];
    await page.route('**/store-cash/shifts?**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.continue());
    await page.route('**/store-cash/opening-context**', (r) => r.fulfill({ json: { storealreadyopen: false, reason: null, previous: null } }));
    await page.route('**/store-cash/templates/suggest**', (r) => r.fulfill({ json: { template: templates[1], within: true, tolerance: 120, now: '15:10' } }));
    await page.route('**/store-cash/templates?**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: templates }) : r.continue());
    await page.reload();

    await page.getByTestId('shift-card-open').click();
    const select = page.getByTestId('shiftdesk-template-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('72');                                                        // Evening is the one that fits 15:10
    await expect(page.getByTestId('shiftdesk-template-note')).toContainText('Picked for 15:10');
    await expect(page.getByTestId('shiftdesk-template-note')).toContainText('The times are a plan');
    await select.selectOption('71');
    await expect(page.getByTestId('shiftdesk-template-note')).not.toContainText('Picked for');     // a changed choice is no longer "picked for"
  });
});
