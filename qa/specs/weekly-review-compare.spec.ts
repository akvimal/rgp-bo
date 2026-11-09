/**
 * Weekly review, fair comparison - REVIEW-5, REVIEW-6
 * The week is set beside what is usual for the same days of the month (the first ten days are the peak), exceptions are judged as rates, and the month to
 * date is set beside the same dates last month. Open to the Business Head, Owner-operator and Store Head.
 */
import { test, expect } from '../fixtures/index.js';
import { openAs } from '../fixtures/auth.js';

const MGR = process.env.QA_MGR_EMAIL || 'businesshead@local.test';

const week = async (api: any, start: string) => api.request('GET', `/review/week?weekstart=${start}`, undefined, MGR);

test.describe('Weekly review comparison @p1', () => {
  test('REVIEW-5 the week is tagged by part of the month, compared with usual, and given a month to date @happy', async ({ api }) => {
    // Monday 1 June 2026 to Sunday 7 June: all peak days. Monday 15 June to 21 June: six middle days and one late.
    const peak = await week(api, '2026-06-01');
    expect(peak.status, JSON.stringify(peak.body)).toBe(200);
    expect(peak.body.phases.mix).toEqual({ peak: 7, mid: 0, tail: 0 });
    expect(peak.body.phases.days.length).toBe(7);
    const later = (await week(api, '2026-06-15')).body;
    expect(later.phases.mix).toEqual({ peak: 0, mid: 6, tail: 1 });

    // the figures for the week: raw totals, rates, a verdict for each line, and no "week before"
    expect(peak.body.before).toBeUndefined();
    expect(Object.keys(peak.body.actual.rates)).toEqual(expect.arrayContaining(['discountPct', 'belowPer100Lines', 'voidsPer100Bills', 'editsPer100Bills', 'returnsPer100Bills', 'avgBill']));
    expect(Object.keys(peak.body.verdicts).sort()).toEqual(['below', 'bills', 'discount', 'edits', 'returns', 'sales', 'voids']);
    expect(peak.body.actual.raw.bills).toBe(peak.body.summary.bills);          // the same bills as the lists are built from

    // usual is either worked out from earlier months, or absent with the reason and no verdicts
    if (peak.body.usual.raw) {
      expect(peak.body.usual.months.length).toBeGreaterThanOrEqual(2);
      expect(peak.body.usual.months.every((m: string) => m < '2026-06')).toBe(true);
    } else {
      expect(peak.body.usual.reason).toMatch(/earlier months/);
      expect(Object.values(peak.body.verdicts)).toEqual(Array(7).fill('unknown'));
    }

    // month to date against the same dates last month
    expect(peak.body.mtd).toMatchObject({ from: '2026-06-01', to: '2026-06-07', prevFrom: '2026-05-01', prevTo: '2026-05-07' });
    // a week that ends in the first days of a month is compared as the whole month before
    const edge = (await week(api, '2026-08-31')).body;                          // Mon 31 Aug to Sun 6 Sep: ends on the 6th
    expect(edge.mtd.from).toBe('2026-09-01');
    const first = (await week(api, '2026-06-29')).body;                         // Mon 29 June to Sun 5 July: ends on the 5th
    expect(first.mtd.from).toBe('2026-07-01');
    const onFirst = (await week(api, '2026-11-30')).body;                       // Mon 30 Nov to Sun 6 Dec
    expect(onFirst.phases.mix).toEqual({ peak: 6, mid: 0, tail: 1 });
    const short = (await week(api, '2026-08-24')).body;                         // Mon 24 to Sun 30 Aug: far from the start of a month
    expect(short.mtd.to).toBe('2026-08-30');
  });

  test('REVIEW-6 the screen shows the comparison with usual, the rates and the month to date, not the week before @happy', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, MGR, '/secure/review');
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('review-phases')).toContainText('This week has');
    await expect(page.getByRole('heading', { name: 'This week against what is usual for these days' })).toBeVisible();
    await expect(page.getByTestId('review-rates')).toBeVisible();
    for (const row of ['review-row-bills', 'review-row-sales', 'review-row-discounts', 'review-row-below', 'review-row-voids', 'review-row-edits', 'review-row-returns']) {
      await expect(page.getByTestId(row)).toBeVisible();
    }
    await expect(page.getByTestId('review-mtd')).toBeVisible();
    await expect(page.getByTestId('review-mtd-range')).toContainText('against');
    // either the basis of "usual" or the reason there is none
    await expect(page.getByTestId('review-usual-basis').or(page.getByTestId('review-usual-none'))).toBeVisible();
    await expect(page.getByText('Week before')).toHaveCount(0);
    // moving to an earlier week reloads the comparison
    const range = await page.getByTestId('review-week').innerText();
    await page.getByTestId('review-prev').click();
    await expect(page.getByTestId('review-week')).not.toHaveText(range);
    await expect(page.getByTestId('review-rates')).toBeVisible();
    await ctx.close();
  });
});
