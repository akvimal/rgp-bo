/**
 * Recognition on screen - RC-UI-1..2
 * A person is thanked by their store head and sees the note once as a celebration, with their badges and progress beneath; the heads see the team card
 * with a line of thanks to send. Each test makes its own store and people.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = 'admin123';

async function setup(api: any) {
  const s = await api.request('POST', '/stores', { location: `RCU ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
  const mk = async (roleid: number, name: string) => {
    const email = `qa.rcu.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
    const r = await api.request('POST', '/users', { fullname: name, email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid, storeids: [s.body.id] }, MGR);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    return { email, id: r.body.id as number };
  };
  return { head: await mk(3, 'RCU Head'), sales: await mk(2, 'RCU Seller') };
}

test('RC-UI-1 a thanked person sees the note once, with their badges beneath', async ({ api, app }) => {
  const { head, sales } = await setup(api);
  expect((await api.request('POST', '/recognition/thanks', { to: sales.id, text: 'Thank you for the calm rush on Saturday' }, head.email)).status).toBe(201);
  const { page } = await app.open(sales.email, '/secure/dashboard');
  const cele = page.getByTestId('sv-celebration');
  await expect(cele).toBeVisible();
  await expect(cele).toContainText('Thank you for the calm rush on Saturday');
  await expect(page.getByTestId('sv-badges')).toBeVisible();
  await expect(page.getByTestId('badge-till')).toBeVisible();
  await page.getByTestId('sv-celebration-ok').click();
  await expect(cele).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('sv-badges')).toBeVisible();
  await expect(page.getByTestId('sv-celebration')).toHaveCount(0);
  await expect(page.getByTestId('sv-notes')).toContainText('Thank you for the calm rush on Saturday');
});

test('RC-UI-2 the store head sees the team card and sends thanks from it', async ({ api, app }) => {
  const { head, sales } = await setup(api);
  const { page } = await app.open(head.email, '/secure/dashboard');
  const card = page.getByTestId('team-recognition');
  await expect(card).toBeVisible();
  await expect(card).toContainText('RCU Seller');
  await page.getByTestId(`tr-thank-${sales.id}`).click();
  await card.getByLabel('Thanks to RCU Seller').fill('Thank you for staying late on Friday');
  await card.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(card).toContainText('Thanks sent to RCU Seller');
  const mine = await api.request('GET', '/recognition/mine', undefined, sales.email);
  expect(mine.body.notes[0].text).toBe('Thank you for staying late on Friday');
});
