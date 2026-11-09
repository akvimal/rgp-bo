# Weekly review: fair comparison for a month with a peak (1st to 10th)

Status: designed and **step 1 built 2026-11-09** (uncommitted). Steps 2 and 3 not built.

## Problem

The weekly review (`/secure/review`, `api-v2/src/modules/app/review/`) set each week's figures beside the week before: bills, sales, and the *counts and values* of discounts, items billed below list, discarded held bills, edited bills and returns. In a pharmacy the first ten days of the month are the peak (monthly refills, salary days). The week that covers them has more of everything, and the week after looks like a collapse. A count that merely follows volume says nothing about whether staff behaved differently.

## Principles

1. **Judge behaviour by rates, not counts.** Volume cancels out: a busy week with the same discount rate is normal.
2. **Compare with what is usual for the same days of the month**, not with the previous week.
3. **Month to date against the same dates last month** is the cleanest single comparison for this pattern.
4. Flag a week only when it is **worse than usual by a clear margin and by more than a few events** (a store with 6 bills a day must not be flagged for one extra return).

## Step 1 (built)

- **Phases of the month**: peak = days 1 to 10, middle = 11 to 20, tail = 21 to month end (constants `PEAK_END`, `MID_END` in `review-rules.ts`). Each day of the reviewed week is tagged; the screen shows the mix ("3 peak days, 4 middle days").
- **Usual**: for each day of the week, the average of that day's phase over the **three calendar months before it**, per metric; summed over the week gives "usual for these days". A month counts only if sales were made on at least 15 different days (so a month when the store opened, or was shut, does not distort it), and at least 2 such months are needed, otherwise the screen says there is not enough history and shows the rates alone.
- **Rates** (from per-day totals, so they are the same measure for the week and for "usual"): discount given as % of sales before discount; items billed below list per 100 billed items; held bills discarded, bills edited and returns, each per 100 bills; returns value as % of sales.
- **Verdict** per row: *above usual* when the rate is at least 25% over the usual rate **and** at least 3 more events than usual (mirror for *below*); sales and bills are *higher* or *lower* when 15% away from usual. Otherwise *as usual*.
- **Month to date**: the month of the week (to the week's last day, or today if the week is still running) against the previous month's same dates: bills, sales, discount %, returns.
- The old "week before" column is gone. The lists below the summary (the bills, lines and returns themselves, the "to look at closely" marks and the sign-off) are unchanged.

### API (`GET /review/week`)
`before` is replaced by: `phases` (day and phase for the week, with the mix), `actual` (raw per-day totals summed, and rates), `usual` (the same for the expected week, or `null` with a `reason`), `verdicts`, and `mtd` (both ranges, raw totals and rates). `summary`, `marked`, the lists and the sign-off are as before.

### Checked
- 21 unit tests of the rules (`review-compare.spec.ts`), tsc clean, and two Playwright specs (`weekly-review-compare.spec.ts`: API shape for known weeks, and the screen with real clicks).
- On a copy of the production data (62,000 bills, Feb 2022 to Nov 2026, one store; answered in about 0.6 s): the peak shows in the basket, not the bill count (average bill 295 in the week of 5 Oct, 6 peak days, against 188 in the week of 26 Oct). Sales were 23% above usual for the peak week and bills 7%; against the plain week before the same week would have looked like a far larger jump. That store gives no discounts, so the discount rate is 0.
- A week ending on the 1st to 3rd of a month is compared as the whole month before (the month to date of one day is not useful).
- Not checked: a store with discounts, discards and edits at volume (the existing `weekly-review.spec.ts` creates those; it was not run here).

### Known limits
- Peak days are fixed at 1 to 10 for every store. If stores differ, the baseline should be learned per store (open question).
- Closed days count as zero in both the week and the usual, so a shop closed on Sundays is compared fairly with itself; a one-off closure is not adjusted.
- Festival and seasonal weeks (monsoon fever season, Diwali) are not separated; a same-month-last-year comparison would be step 2.
- The discard, edit and return dates follow the date of the event, not the bill, as the lists already do.

## Not built (steps 2 and 3)

2. A same-week-last-year line and a person-against-person view (discount rate and below-list lines by cashier within the week).
3. New lines: unmet demand (requests and "not in stock" lookups), refill capture (customers due vs served), average bill and items per bill, margin %, generic substitution rate, cash short or over per shift, new vs repeat customers and dues collected, stock health.

## Open questions
- Are the peak days the same in every store?
- Is purchase cost reliable enough to show margin %?
