/**
 * The pharmacy guide - GUIDE-1..5
 * Indian retail pharmacy compliance in plain words, and a training guide for new staff. Everyone in a pharmacy business may open it.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

test('GUIDE-1 the guide opens from the menu for the owner and shows the three schedules with what each requires', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await page.getByTestId('nav-pharmacy-guide').click();
  await expectShell(page);
  await expect(page.getByRole('heading', { name: 'Pharmacy guide' })).toBeVisible();
  await expect(page.getByTestId('guide-rules')).toContainText('No prescription, no Schedule H, H1 or X medicine');
  await page.getByTestId('guide-nav-schedules').click();
  await expect(page.getByTestId('guide-chapter-title')).toContainText('Medicine schedules');
  await expect(page.getByTestId('guide-schedule-H').getByTestId('guide-schedule-headline')).toHaveText('Prescription required');
  await expect(page.getByTestId('guide-schedule-H1').getByTestId('guide-schedule-headline')).toHaveText('Prescription + mandatory H1 register');
  await expect(page.getByTestId('guide-schedule-X').getByTestId('guide-schedule-headline')).toHaveText('Special licence + prescription + locked inventory');
});

test('GUIDE-2 any role in a pharmacy business can open it, not only the owner', async ({ app }) => {
  const { page } = await app.open(SALES, '/secure/pharmacy-guide');
  await expectShell(page);
  await expect(page.getByTestId('guide-chapter-title')).toContainText('Start here');
  await expect(page.getByTestId('nav-pharmacy-guide')).toBeVisible();
});

test('GUIDE-3 it works as a training guide: a learning path for a new member of staff, and a quiz that shows answers on request', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/pharmacy-guide');
  await expect(page.getByTestId('guide-path-0')).toContainText('Day 1');
  await expect(page.getByTestId('guide-path-2')).toContainText('First week');
  await page.getByTestId('guide-path-0').getByRole('button', { name: 'Medicine schedules' }).click();
  await expect(page.getByTestId('guide-chapter-title')).toContainText('Medicine schedules');

  await page.getByTestId('guide-nav-quiz').click();
  const first = page.getByTestId('guide-quiz-q').first();
  await expect(first.getByTestId('guide-quiz-answer')).toHaveCount(0);
  await first.getByTestId('guide-quiz-show').click();
  await expect(first.getByTestId('guide-quiz-answer')).toBeVisible();
});

test('GUIDE-4 the counter situations open to steps to follow, and the words chapter can be filtered', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/pharmacy-guide?c=counter');
  const s = page.getByTestId('guide-scenario').first();
  await expect(s).toContainText('Schedule H medicine and has no prescription');
  await s.locator('summary').click();
  await expect(s).toContainText('not allowed to sell it without one');

  await page.getByTestId('guide-nav-concepts').click();
  await page.getByTestId('guide-term-filter').fill('expiry');
  await expect(page.getByTestId('guide-term').first()).toContainText('Expiry date');
});

test('GUIDE-5 search finds a topic across the whole guide and opens its chapter; the product form links to the schedules', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/pharmacy-guide');
  await page.getByTestId('guide-search').fill('h1 register');
  await expect(page.getByTestId('guide-results')).toBeVisible();
  const hit = page.getByTestId('guide-hit').first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.getByTestId('guide-results')).toHaveCount(0);

  const form = await app.open(MGR, '/secure/products/master/new');
  await form.page.locator('#category').selectOption('Medicine');
  await expect(form.page.getByTestId('prod-schedule-help')).toHaveAttribute('href', /pharmacy-guide\?c=schedules/);
});
