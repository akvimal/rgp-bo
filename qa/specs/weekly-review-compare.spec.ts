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
    expect(Object.keys(peak.body.verdicts).sort()).toEqual(['below', 'bills', 'discount', 'edits', 'generic', 'lookups', 'margin', 'returns', 'sales', 'unmet', 'voids']);
    expect(peak.body.actual.raw.bills).toBe(peak.body.summary.bills);          // the same bills as the lists are built from

    // usual is either worked out from earlier months, or absent with the reason and no verdicts
    if (peak.body.usual.raw) {
      expect(peak.body.usual.months.length).toBeGreaterThanOrEqual(2);
      expect(peak.body.usual.months.every((m: string) => m < '2026-06')).toBe(true);
    } else {
      expect(peak.body.usual.reason).toMatch(/earlier months/);
      expect(Object.values(peak.body.verdicts)).toEqual(Array(11).fill('unknown'));
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

  test('REVIEW-7 the same dates a year ago line up by weekday, and each person is set against the others @happy', async ({ api }) => {
    const r = await week(api, '2026-06-01');                                    // Monday 1 June 2026
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    // 52 weeks earlier is a Monday too
    expect(r.body.yearAgo.week).toMatchObject({ from: '2025-06-02', to: '2025-06-08' });
    expect(new Date('2025-06-02T00:00:00Z').getUTCDay()).toBe(1);
    expect(r.body.yearAgo.mtd).toMatchObject({ from: '2025-06-02', to: '2025-06-08' });
    expect(typeof r.body.yearAgo.available).toBe('boolean');
    expect(r.body.yearAgo.week.raw).toHaveProperty('sales');
    // people: the bills of the people add up to the week's bills, most sales first, each with a verdict for the five exceptions
    const people = r.body.people as any[];
    expect(people.reduce((a, p) => a + p.bills, 0)).toBe(r.body.actual.raw.bills);
    expect(people.map((p) => p.sales)).toEqual([...people.map((p) => p.sales)].sort((a, b) => b - a));
    for (const p of people) {
      expect(p.name).toBeTruthy();
      expect(Object.keys(p.verdicts).sort()).toEqual(['below', 'discount', 'edits', 'margin', 'returns', 'voids']);
      if (p.bills < r.body.peerRules.minBills) expect(Object.values(p.verdicts)).toEqual(Array(6).fill('unknown'));
    }
    expect(r.body.peerRules.minBills).toBeGreaterThan(0);
  });

  test('REVIEW-8 margin and mix, the cash drawer, pay-later dues and unmet requests are part of the week @happy', async ({ api }) => {
    const r = await week(api, '2026-06-01');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const rates = r.body.actual.rates;
    for (const k of ['marginPct', 'genericPct', 'namedPct', 'newCustPer100Bills', 'unmetPer100Bills']) expect(rates).toHaveProperty(k);
    expect(r.body.actual.raw.costedSales).toBeGreaterThanOrEqual(0);
    if (rates.marginPct !== null) expect(rates.marginPct).toBeLessThan(100);
    expect(r.body.actual.raw.named).toBeLessThanOrEqual(r.body.actual.raw.bills);
    expect(r.body.actual.raw.unmet).toBeLessThanOrEqual(r.body.actual.raw.inquiries);

    // week-level extras: each is an object, or null when the database has no such table (the review still loads)
    const { cash, dues, asked } = r.body.more;
    if (cash) {
      expect(cash.closed).toBeLessThanOrEqual(cash.shifts);
      expect(cash.off).toBe(cash.short + cash.over);
      expect(cash.shortTotal).toBeGreaterThanOrEqual(0);
      for (const row of cash.offList) expect(Math.abs(row.variance)).toBeGreaterThan(1);
    }
    if (dues) {
      expect(dues.given).toBeGreaterThanOrEqual(0);
      expect(dues.collected).toBeGreaterThanOrEqual(0);
      expect(dues.outstanding).toBeGreaterThanOrEqual(0);
    }
    if (asked) {
      expect(asked.unmet + asked.ordered + asked.sold).toBeLessThanOrEqual(asked.raised);
      expect(Array.isArray(asked.top)).toBe(true);
    }
  });

  test('REVIEW-9 a brand check at the counter is kept, and the weekly review counts the ones with no match @happy', async ({ api }) => {
    const monday = (() => { const d = new Date(Date.now() + 5.5 * 3600000); const dow = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10); })();
    const before = (await week(api, monday)).body;
    test.skip(!before.more?.lookups, 'this database has no brand check log (migration 177)');
    const log = (body: any) => api.request('POST', '/sale-alternatives/lookup-log', { storeid: 1, ...body }, MGR);

    // validation: a kind is needed, typed text needs three letters, a brand or product needs an id
    expect((await log({ kind: 'NOPE' })).status).toBe(400);
    expect((await log({ kind: 'TYPED', text: 'ab' })).status).toBe(400);
    expect((await log({ kind: 'BRAND' })).status).toBe(400);
    expect((await log({ kind: 'PRODUCT' })).status).toBe(400);

    // a brand typed that nothing matched is a miss; a product that is in stock is a hit
    const name = `QA-NOBRAND-${Date.now()}`;
    const miss = await log({ kind: 'TYPED', text: `  ${name}  ` });
    expect(miss.status, JSON.stringify(miss.body)).toBeLessThan(300);
    expect(miss.body.outcome).toBe('NOT_FOUND');
    const stock = (await api.request('POST', '/stock/filter', { available: true, limit: 50, storeid: 1 }, MGR)).body.find((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 0);
    expect(stock).toBeTruthy();
    const hit = await log({ kind: 'PRODUCT', productid: stock.id });
    expect(hit.status, JSON.stringify(hit.body)).toBeLessThan(300);
    expect(['IN_STOCK', 'NO_COMP', 'OTHER_FORM', 'NOT_STOCKED']).toContain(hit.body.outcome);

    const after = (await week(api, monday)).body;
    expect(after.more.lookups.total).toBe(before.more.lookups.total + 2);
    expect(after.more.lookups.noMatch).toBeGreaterThanOrEqual(before.more.lookups.noMatch + 1);
    expect(after.more.lookups.top.some((t: any) => t.name === name)).toBe(true);
    expect(after.actual.raw.lookups).toBe(before.actual.raw.lookups + 2);
    expect(after.actual.raw.noMatch).toBeGreaterThanOrEqual(before.actual.raw.noMatch + 1);
    expect(after.verdicts).toHaveProperty('lookups');
  });

  test('REVIEW-10 refill capture: the week before and this week are counted from the bills, against the weeks before @happy', async ({ api }) => {
    // Monday 1 June 2026: the cohorts are 25 to 31 May and 1 to 7 June
    const r = await week(api, '2026-06-01');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const f = r.body.refill;                                            // null when the database has no regular chronic customers
    if (!f) return;
    expect(f.prev).toMatchObject({ from: '2026-05-25', to: '2026-05-31' });
    expect(f.thisWeek).toMatchObject({ from: '2026-06-01', to: '2026-06-07' });
    expect(f.usual.to).toBe('2026-05-24');
    expect(f.rules).toMatchObject({ graceDays: 7, lapsedDays: 45, usualWeeks: 13, minEvents: 3 });
    for (const c of [f.prev, f.thisWeek, f.usual]) {
      expect(c.onTime + c.late + c.notBack + c.lapsed + c.open).toBe(c.due);            // every customer is in exactly one group
      expect(c.decided).toBe(c.due - c.open);                                          // those still within the grace period are left out of the rate
      expect(c.missed).toBe(c.late + c.notBack + c.lapsed);
      if (c.decided > 0) expect(c.captureRate).toBeCloseTo((c.onTime / c.decided) * 100, 0);
      else expect(c.captureRate).toBeNull();
    }
    expect(['above', 'usual', 'below', 'unknown']).toContain(f.prev.verdict);
    // a week long gone has nothing left within its grace period
    expect(f.prev.open).toBe(0);
    expect(f.calls.called.n + f.calls.notCalled.n).toBeGreaterThanOrEqual(0);
    expect(f.calls.called.onTime).toBeLessThanOrEqual(f.calls.called.n);
  });

  test('REVIEW-6 the screen shows the comparison with usual, the rates and the month to date, not the week before @happy', async ({ browser, api }) => {
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
    // a year ago (or the note that there was nothing), and each person against the others
    await expect(page.getByTestId('review-year').or(page.getByTestId('review-year-none'))).toBeVisible();
    await expect(page.getByTestId('review-people')).toBeVisible();
    await expect(page.getByTestId('review-people-note')).toContainText('well over');
    // margin and mix, and the week-level sections (each shown when the database has what it needs)
    await expect(page.getByTestId('review-mix')).toBeVisible();
    for (const row of ['review-row-margin', 'review-row-generic', 'review-row-named', 'review-row-newcust', 'review-row-unmet']) await expect(page.getByTestId(row)).toBeVisible();
    await expect(page.getByTestId('review-row-lookups')).toBeVisible();
    await expect(page.getByTestId('review-people')).toContainText('Margin %');
    await expect(page.getByTestId('review-cash-summary')).toBeVisible();
    // refill capture is shown when the database has regular chronic customers (the API says so for the same week)
    const shown = !!(await api.request('GET', '/review/week', undefined, MGR)).body?.refill;
    if (shown) { await expect(page.getByTestId('review-refill')).toBeVisible(); await expect(page.getByTestId('review-refill-note')).toContainText('On time'); }
    await expect(page.getByTestId('review-asked')).toBeVisible();
    // either the basis of "usual" or the reason there is none
    await expect(page.getByTestId('review-usual-basis').or(page.getByTestId('review-usual-none'))).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Week before', exact: true })).toHaveCount(0);       // the old comparison column is gone
    // moving to an earlier week reloads the comparison
    const range = await page.getByTestId('review-week').innerText();
    await page.getByTestId('review-prev').click();
    await expect(page.getByTestId('review-week')).not.toHaveText(range);
    await expect(page.getByTestId('review-rates')).toBeVisible();
    await ctx.close();
  });
});
