# Weekly review: fair comparison for a month with a peak (1st to 10th)

Status: designed; **step 1 built and committed 2026-11-09 (fffa6d79d); step 2 committed 2026-11-09 (436143783); step 3 committed 2026-11-09 (1498ad204); step 4 built 2026-11-09 (uncommitted)**.

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

## Step 2 (built)

- **The same dates a year ago**: the week against the week 52 weeks earlier (so a Monday meets a Monday), and the month to date against its dates shifted the same 52 weeks. Bills, sales and average bill, with the change. No verdict is given: a festival or the season moving between years changes the week, so the figures are for reading. If the stores had no bills then (a new store) the screen says so.
- **By person, against the others**: bills are credited to the person at the counter (`acting_user_id` when someone else is logged in, otherwise the maker); discards, edits and returns to the person who did them. For each person: bills, sales, average bill, discount % and below-list per 100 items (each shown beside the rate of everyone else), discards, edits and returns. A cell is shaded only when the rate is at least 1.5 times the others' **and** there are 3 or more cases beyond what the others' rate would give for that person's volume. A person needs 20 bills, and so do the others together; with one biller there is nothing to compare, so no verdict. This does not depend on the part of the month, because everyone is in the same week. It is a prompt to ask, not a finding.
- API additions to `GET /review/week`: `yearAgo` (`available`, `week`, `mtd`, each with raw totals and rates), `people` (raw totals, rates, `peerRates`, `verdicts`; most sales first) and `peerRules`.
- Checked: 25 unit tests of the rules; Playwright `REVIEW-5/6/7`; on the production-data copy the week of 5 Oct 2026 against 6 Oct 2025 showed sales +19% and bills -3% (average bill +24%), and month to date -4% on sales. That store has one biller, so the person comparison was only shown with one row; the rule is covered by the unit tests, not by real multi-person data.

## Step 3 (built)

Added to the same screen and API. The first group is worked out per day, so it is set against "usual for these days" like the rest; the second group is for the week only.

**Margin and mix** (per day, in `daily()`, so each has a usual):
- **Margin %**: items sold for, less their purchase cost, on lines whose purchase cost is known (`purchase_invoice_item.ptr_cost` per pack, divided by the pack, times units), before GST. Returns are not taken off. Marked **below usual** when 3 percentage points or more under (above usual is only noted).
- **Generic share** of items billed (`more_props.generic`): noted when 5 points or more from usual, neither direction a warning.
- **Bills with a named customer**, and **new customers** (customers whose first bill at these stores fell in the week): shown, not marked.
- **Requests we could not meet** per 100 bills (customer inquiries raised in the week and closed "not available"): marked **above usual** by the same rule as the other rates (25% over and 3 more cases).

**Week only** (`more` in the API; each is `null` when its table is missing in an older database, so the review still loads):
- **Cash drawer**: shifts closed, how many were out by more than Rs 1 (the same tolerance as the checklist assistant), short and over with totals and the biggest, the shifts listed with who was accountable; and shifts opened and never closed by the end of their day.
- **Pay later**: dues given and collected in the week, and the number of customers owing and the total at the end of the week.
- **Asked for and not available**: inquiries raised, how many ended not available / ordered / sold, how many are open past the promised day, and the most-asked-for products that were not available (the same product typed differently is counted once).

Checked: 31 unit tests of the rules; Playwright `REVIEW-5` to `REVIEW-8`; on the production-data copy the week of 5 Oct 2026 showed margin 49.9% against a usual 52.7%, generic share 65.2% (66.1%), and with seeded shifts, inquiries and dues the cash, asked-for and pay-later sections matched the seeded figures (a Rs 0.50 difference correctly ignored, an open shift listed, "Telma 40" typed two ways counted twice). The review answers in about 1.1 s. The production copy had no pay-later table, which showed the section being left out cleanly.

### Not built, and why
- **Refill capture** (customers due vs served): "due" is a rule over each customer's buying gap, so the question is who was due on which day, and history cannot be rebuilt reliably after the fact. It needs a daily snapshot of the worklist first. The dashboard already counts refill calls.
- **Stock health** (near-expiry value, negative stock, count variance): a state, not a weekly flow, and the alerts already raise it.
- **Margin by person or by product class**, **unmet demand from "not in stock" lookups** in Check brand (not logged yet), **cash short or over per person over time**: possible next.
- **Margin limits**: purchase cost is taken from the batch sold; a missing cost leaves the line out (shown on production data: every sold line had one). Discounts are inside the selling price, returns are not deducted, and GST is excluded.

## Step 4 (built)

The plan ended at step 3, so step 4 is the "possible next" items from step 3 that were small and had the data. Refill capture stays out (it needs its own design).

- **Brand checks at the counter are kept** (migration 177, table `brand_lookup_event`; re-runnable, with a rollback). When staff pick a brand from the dictionary, pick a product from our own list, or type a brand that nothing matches and close the dialog without choosing anything else, the dialog sends `POST /sale-alternatives/lookup-log`. The **server** works out the outcome from the same lookup the screen used (not from the screen): in stock (same composition, strength and form, or the product itself), only another form, nothing in stock, no composition to match on, or typed and not found. Name, composition and form are copied at the time, since the dictionary may be replaced by a newer release. A failure to log never affects the counter.
- **In the weekly review**: "brand checks with no match in stock, per 100 bills" (only another form, nothing in stock, or not found) in the margin and mix table with a usual for these days and the same *above usual* rule (25% over and 3 more cases); and a "Brands checked at the counter" section with the number of checks, how many had a match, and the brands checked most often with no match (the same brand typed two ways counted once, with its composition), as a prompt to consider stocking them. If migration 177 has not been run, the figure counts as none and the section is left out; the review still loads.
- **Margin per person** in the by-person table, beside the rest of the team's margin. It is shaded only when the margin is 5 or more points *under* the others' (a high margin is not a worry) and the person sold at least Rs 2,000 on costed lines, so a few items do not decide it.
- Checked: 40 related backend unit tests (including that the migration's allowed kinds and outcomes match the code), 37 frontend tests (the dialog logs a picked brand and product, a typed miss only when closed with nothing else chosen, and never fails the counter), Playwright `REVIEW-9` and `BD-5` with real clicks (a picked brand and a typed miss both reach the review's counts), the migration applied, rolled back and re-applied, on a copy of the production data with the real brand list imported.
- Not built: logging a check by who made it (only the login is kept), a screen to see the log itself, and the daily snapshot that refill capture needs.

## Open questions
- Are the peak days the same in every store?
- Margin % is shown with its limits stated; confirm the owner is happy with margin before GST and before returns.
