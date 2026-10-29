/**
 * Dashboard view by role - DV-1..2
 * The server says which view a role opens and which widgets it holds; a role never gets a widget the design keeps from it.
 */
import { test, expect } from '../fixtures/index.js';

test('DV-1 each role is told its own view and widget list', async ({ api }) => {
  const owner = await api.request('GET', '/dashboard/view', undefined, 'businesshead@local.test');
  expect(owner.status).toBe(200);
  expect(owner.body.view).toBe('owner');
  expect(owner.body.widgets[0]).toBe('needs');
  expect(owner.body.widgets).toContain('purchasing');
  const head = await api.request('GET', '/dashboard/view', undefined, 'storehead@local.test');
  expect(head.body.view).toBe('manager');
  expect(head.body.widgets).not.toContain('purchasing');
});

test('DV-2 the business choices for the views come with it', async ({ api }) => {
  const r = await api.request('GET', '/dashboard/view', undefined, 'businesshead@local.test');
  expect(r.body.settings).toMatchObject({ amounts: 'with GST', default_period: 'month to date' });
});
