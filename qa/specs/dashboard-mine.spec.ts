/**
 * Staff and Counter dashboard figures - DM-1..3
 * A person sees their own day against their own usual and the store's shared day, never another person's figures or a customer name; the three
 * roles without the dashboard before can now open it.
 */
import { test, expect } from '../fixtures/index.js';

const SALES = 'sales1@local.test';

test('DM-1 a sales person gets their own day, goals and the store day', async ({ api }) => {
  const r = await api.request('GET', '/dashboard/mine', undefined, SALES);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(r.body.view).toBe('staff');
  expect(r.body.today).toHaveProperty('sales');
  expect(Array.isArray(r.body.hours)).toBe(true);
  expect(r.body.hours.length).toBe(13);
  expect(r.body.goals.map((g: any) => g.key)).toEqual(['capture', 'parked', 'deliveries']);
  for (const g of r.body.goals) expect(g.pct).toBeGreaterThanOrEqual(0);
  expect(r.body.store).toHaveProperty('captureAim');
});

test('DM-2 nothing in it names a customer or another person', async ({ api }) => {
  const r = await api.request('GET', '/dashboard/mine', undefined, SALES);
  const text = JSON.stringify(r.body).toLowerCase();
  for (const bad of ['customer_name', 'fullname', 'full_name', 'mobile"', 'ptrcost', 'margin']) expect(text).not.toContain(bad);
});

test('DM-3 Sales Staff, Counter and Personal can open the dashboard page', async ({ api }) => {
  const roles = await api.request('GET', '/roles', undefined, 'businesshead@local.test');
  expect(roles.status).toBe(200);
  for (const name of ['Sales Staff', 'Counter', 'Personal']) {
    const role = roles.body.find((x: any) => x.name === name);
    expect(role, name).toBeTruthy();
    expect(JSON.stringify(role.permissions)).toContain('/secure/dashboard');
  }
});
