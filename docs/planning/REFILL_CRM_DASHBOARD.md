# Refill and follow-up: one contact log, a turnaround measure, and a "My work" dashboard for sales staff

Status: **planned 2026-11-19; steps 1 (one contact log), 2 (turnaround measure) 3 (dashboard), 4 (refill by medicine) and 5 (retry rules) built 2026-11-19; only the later ideas remain.** Asked for: a sales-staff dashboard with refill reminders, follow-ups and turnaround. Clarified: **turnaround = the contacted customer bought again and went back to the normal course.** Follow-up review also asked for gaps in the refill system, which has grown into a small CRM.

## 1. What exists today (read from the code)

| Piece | Where | What it does |
|---|---|---|
| Refill list | `api-v2/src/modules/app/quality/refill.service.ts` | Customers with 3 or more visits that included a chronic medicine (`product.more_props->>'chronic'`) and a real mobile. Usual gap = median days between those visits (gaps under 7 days ignored). Due = last visit + usual gap. Buckets UPCOMING, OVERDUE, LAPSED. Message from the shop's "due back" wording. |
| Refill follow-up | table `refill_followup` (migration 042) | Outcome WILL_BUY, NO_ANSWER, CALLBACK, BOUGHT_ELSEWHERE, NOT_NEEDED; hides the customer for a few days (`snoozed_until`). |
| Refill results | `refill.service.ts` `results()` | Of customers contacted in the last 30 days (their latest contact only, NO_ANSWER excluded), how many bought any chronic medicine at any time after. |
| Contact worklist | `customers/customer-followup.service.ts`, table `customer_contact_log` (migration 123) | Audiences due_back, at_risk, new_second_visit, dues. Channel CALL, WHATSAPP, SMS, VISIT, OTHER. Outcome SENT, REACHED, NO_ANSWER, CALLBACK, NOT_INTERESTED, WRONG_NUMBER, ASKED_TO_STOP. Consent and daily contact cap respected. |
| Staff dashboard | `frontend/src/app/secured/dashboard-views/staff-view.component.ts` | Goal ring, to-do items, parked bills, store day. No customer names. |
| Related, built | customer orders (advance-paid special orders), inquiries, to-dos, alerts engine, households (designed, not built), customers without a mobile (name + location) |

## 2. Gaps found

1. **Two follow-up logs.** `refill_followup` and `customer_contact_log` record the same kind of act with different outcomes and never see each other. A customer can be called from both screens, and neither shows the other's contact.
2. **Turnaround is measured loosely.** `results()` has no window, uses only the latest contact, counts any chronic purchase, ignores who made the contact, and has no baseline for customers who would have come back anyway.
3. **Refill timing is a guess.** Visit gaps only; the quantity dispensed is never used, and the logic is per customer, not per medicine. Someone on three chronic medicines is "due" when any one is, and the message cannot say which.
4. **Customers with no real mobile are invisible** to the refill list, and nowhere shown as "cannot be reached".
5. **No retry or escalation rule.** There are outcomes and a snooze, but nothing like "no answer on day 3, then a message, then flag for a manager".
6. **No reason recorded when a customer does not return** (price, moved, bought elsewhere, stopped the medicine). Only BOUGHT_ELSEWHERE exists, and only on the refill screen.
7. **No view of the person's own work.** A sales person has to open two screens to find who to call and cannot see how their calls ended.

## 3. Turnaround, defined

A contact **turns around** when the customer has a completed bill within a window after the contact.

- **Window:** a shop setting. Defaults: 7 days for a due-back refill, 14 days for a not-seen-for-a-while customer. For refills it is judged from the **due date** as well as the contact date, so "bought 8 days late, a day after the call" is shown as a late refill that the call helped, not a clean win. (Open question 1: a fixed window or the customer's own usual gap.)
- **What counts as buying again:** for a refill audience, a bill with a chronic medicine (later, the specific medicine); for the other audiences, any bill.
- **Result per contact:** *Came back* (days, bill value), *Waiting* (days left in the window), or *Lapsed* (window passed).
- **Credit:** a bill is credited to the person who made the **latest** counted contact in its window, so two people never both claim it. The shared Counter login credits the acting operator, the same pattern as to-dos.
- **Baseline:** next to the contacted return rate, show the return rate of comparable customers (same audience, same due-date range) who were **not** contacted in the period. The gap between the two is the lift. Without it the percentage flatters the follow-up.
- **Excluded from the rate:** WRONG_NUMBER, ASKED_TO_STOP, and customers who have not consented to messages (as `contactable()` already decides).

## 4. The dashboard, "My work", for Sales Staff and Counter

In the order a person works. No cost, no margin, no other person's sales, and no customer details beyond what the counter already sees.

1. **Call today.** Refills due and overdue, not seen for a while, second visits and dues, as one list. Each row: name, the usual medicines, days overdue, one-tap call or WhatsApp with the shop's wording. Ends in an outcome (Reached, No answer, Callback, Not interested, Bought elsewhere, Wrong number, Asked to stop) and an optional reason.
2. **Waiting to come back.** Everyone I contacted who has not bought yet, with days left in the window. A second nudge is suggested on day 3 or 4; at the end of the window the row moves to Lapsed.
3. **Turnaround scorecard** (this week against last week): contacts made, came back (number and percent), median days to return, sales value recovered, lapsed, and the baseline lift. Staff see their own numbers; managers see the team.
4. **Promised to customers.** Special orders that have arrived and the customer has not been told, orders whose hold is ending, and inquiries assigned to me that are overdue. All read from existing tables.
5. **Cannot reach.** Regular customers with no usable contact route, with a way to add a mobile or location.
6. Existing tiles (goal ring, to-dos, parked bills) stay below.

Tone: no ranking of colleagues; targets shown as colour, not league tables.

## 5. Plan, in order

### Step 1 - One contact log (foundation) - BUILT 2026-11-19
As built: migration `230_one_contact_log.sql` (+ rollback) adds `source`, `due_on`, `snoozed_until`, `reason`, `refill_followup_id` to `customer_contact_log`, allows the outcomes WILL_BUY, BOUGHT_ELSEWHERE and NOT_NEEDED, and copies `refill_followup` in (a sent reminder becomes a WhatsApp SENT, the rest are calls). Tried on a copy of `rgp_qa`: applies, re-runs safely, rolls back (a contact made after the copy goes back into `refill_followup`) and re-applies. The Refills page now writes to the log (`refill.service.ts record`, with the day the refill was due) and reads its last contact and snooze from it, so it shows a contact made from the contact list ("contact list" is noted on the row), and the worklist's contact gap sees refill contacts. Customer merge moves the log, and the other readers (customer screen count, dashboard metric, recognition, weekly review, household count script) read the log's refill rows. `refill_followup` stays, unused, for one release. Not done: a Playwright check of the Refills page, and dropping `refill_followup`. A contact from the contact list does not hide a customer from the Refills list by itself (only a refill contact snoozes); it only shows who called last.
Original plan:
- Migration 230: extend `customer_contact_log` with `reason` (text), `due_on` (date, the refill due date when it was a refill contact), `source` ('worklist' or 'refill'), and add outcomes BOUGHT_ELSEWHERE, WILL_BUY, NOT_NEEDED to its check constraint. Copy `refill_followup` rows into it (`channel` 'CALL', `source` 'refill'). Keep `refill_followup` read-only for one release, then drop it.
- The refill screen and the worklist both write to the one log; each shows the other's last contact ("called by Anu 2 days ago") so nobody repeats a call. The snooze rule becomes a function of the log, not a second table.
- Tests: migration re-run and rollback on a scratch copy; both screens write the same row shape; the 7-day and consent rules unchanged.

### Step 2 - Turnaround measure - BUILT 2026-11-19
As built: pure rules in `customer-turnaround-rules.ts` (14 tests), the service `customer-turnaround.service.ts` (`loadTurnaround`, shared with the Refills page), and `GET /customer-relations/turnaround?from&to&userid` (default last 30 days, up to 400). Decisions taken with the plan's defaults, since the open questions were not answered: windows 7 days (refill reminder, judged by a bill with a chronic medicine) and 14 days (any other reason, any bill), set in `app_setting` as `turnaround_refill_days` and `turnaround_lapsed_days` (1 to 60 and 1 to 90) and changed through the existing relationship settings call (`PUT /customer-relations/settings`, `turnaroundRefillDays`, `turnaroundLapsedDays`; needs `relationships.setup`); days are Indian days; a bill goes to the latest counted contact before it, in whose window it falls, and an earlier contact it also fell in is "superseded" and left out of the rate. Not counted: no answer, wrong number, asked to stop, and the dues and review-invite audiences. The rate is of those decided (came back or lapsed), waiting ones are shown with days left. A refill contact with a due date also reports how many days after the due date the bill came. Who sees what: Business Head, Owner-operator and Store Head see everyone's contacts (and one person with `userid`, plus a per-person table); anyone else sees only their own, whatever is asked. (The Store Head sees the whole business's contacts: the contact log has no store.) The Refills page's "contacted and bought" now comes from the same measure (`results()`), with `lapsed`, `waiting` and `median_days` added. Fixed on the way: the settings `put` helper never inserted a setting that had no row yet.
Not done: the baseline of customers who were not contacted (needs a cohort of customers who were due in the period, rebuilt from visits before it; step 3 or later), a screen for it (step 3 holds the scorecard and the window settings), the shared Counter login's acting operator on the contact log, and a Playwright spec.
Original plan:
- Pure `turnaround-rules.ts` (tested): window per audience, matching a contact to the next bill, credit to the latest contact, the baseline group, the exclusions above.
- API: `GET /customers/turnaround?from&to&user` returning per-person and per-store counts, median days, value, lapsed, and baseline. Replaces `refills.results()`.
- Setting: window days per audience (`app_setting`, default 7 and 14).

### Step 3 - "My work" dashboard - BUILT 2026-11-19
As built: `dashboard-views/my-work.component.ts` at the top of the Staff and Counter views (under the needs strip) and `turnaround-card.component.ts`, used there and in the owner and manager dashboard (Customers and service row; only the owner view may change the windows). Widgets: **Call today** (the contact worklist's count by reason and the first six names, linking to the contact list and Refills; no mobile numbers are shown), **Waiting to come back** (my contacts of the last 30 days still inside the window, days left, and those whose window just passed), **the scorecard** (last 7 days against the 7 before: contacts, came back with the count beside the percentage, usual days to return, sales value, waiting, did not come back; a note when fewer than 5 are decided; the team table and the two window inputs for managers), **Promised to customers** (orders that arrived and the customer is not told, holds ending within 2 days, my overdue inquiries) and **Regulars we cannot reach** (new `GET /customer-relations/cannot-reach`: three or more visits in a year and no usable mobile, most valuable first, with an Add number link). Each widget loads on its own and stays out when the role may not read it. The staff view's footer now says customer names appear only in the person's own follow-ups.
Checked: tsc and `ng build`; on a scratch copy of `rgp_qa` with synthetic contacts the Sales Staff view in the browser showed all five widgets with the right numbers (28 to call, 1 waiting, 4 contacted and 3 came back in 7 days, 1 customer with no mobile). Not seen in a browser: the manager variant (the sign-in did not complete); its data is the API's team scope, checked in step 2. Not done: the baseline of uncontacted customers, a Playwright spec, inline outcome buttons on the dashboard (the work is still done on the contact list), phone-width and dark-theme checks.
**Moved to its own page (2026-11-19):** the panel made the dashboard long, so it is now the page **My follow-ups** (`/secure/my-work`, menu Sell, after Customers; `followups-page.component.ts`). The Staff and Counter dashboard keeps one link to it. The scorecard card is gone from the owner and manager dashboard: managers open the same page and see the team's, and the owner changes the return windows there. Page access is a rule in `access-rules.ts` (customers.read or refills.view; no role carries the path), and the app guide has an entry for it.
Original plan:
- New widget set in the Staff and Counter views: Call today, Waiting to come back, Turnaround scorecard, Promised to customers, Cannot reach. Widget frame and refresh pattern from the dashboard kit already used.
- Manager variant of the scorecard (team and store), behind the existing manager dashboard permission.
- QA spec for a contacted customer who buys within the window, one who does not (lapsed), and one who was never contacted (baseline).

### Step 4 - Refill accuracy - BUILT 2026-11-19
Decision taken (the dose-data question was answered by "start step 4", taking the recommendation): the dose is **learned from the customer's own purchases, with a per-product override**, so nothing has to be typed up front. As built: pure rules in `refill-supply-rules.ts` (11 tests) and `refillByMedicine` in `refill.service.ts`. A sale line counts units (the stock view multiplies packs by the pack size), so for each customer and chronic medicine the days between purchases divided by the units bought gives how long a unit lasts them (median of at least two intervals of 5 to 180 days, so top-ups and treatment breaks are left out); the last purchase runs out at its date plus units times that. With fewer than two intervals the product's `supplyDays` attribute (days one unit lasts at the usual dose, a new field on the Medicine attributes in `pharmacy-config.ts`, so it appears on the product form with no form code) is used; with neither, the visit-gap date stands. A customer is due when the earliest of their medicines runs out; medicines running out within a week of it are named together. A customer whose medicines last well past the visit-gap date drops out of the list. Each row shows the medicines due, when each runs out, whether that came from "their own pattern" or "product default", and **Not in stock** or **Short-dated only** (stock on hand from `inventory_view`, business-wide; short-dated means nothing expires beyond 60 days). The shop's wording can use `{medicine}` (the medicines due, up to two, without the code in brackets; "your regular medicines" where there is none, so the contact list is unaffected); `{medicine}` is now an allowed placeholder. Refills list dates now come back as plain `YYYY-MM-DD` text.
Checked on a scratch copy of `rgp_qa` with chronic products flagged and purchases planted: a customer whose 30-unit supply lasts to 9 Dec dropped off the list; one whose supply ended 10 days ago showed 10 days late on their own pattern; a product with no batches showed Not in stock; the token filled in the message. Not done: the till's longer-supply offer is unchanged; a due medicine that is out of stock is flagged but not yet added to the purchase suggestions automatically; stock is business-wide, not per store; one-purchase customers are only found if they already pass the 3-visit rule (a product default does not yet pull in new customers); no Playwright spec; the Refills screen was compiled but not driven in a browser.
**Fix found with demo data (2026-11-19):** the SQL still dropped customers whose visit gap said "not due" before the medicine rules saw them, so a customer with two medicines (one running out) was missed. The "due within a week" test now runs in `refineByMedicine` on the medicine's date where there is one and on the visit-gap date otherwise; the query returns every qualifying customer, so the list is a little heavier on a large chronic base. **Demo data:** `qa/seed/refill-demo.sql` plants ten chronic medicines and nine customers in each state (overdue, due soon, not yet due, lapsed, two medicines, no stock, big pack, came back) plus the contacts for retry reminders and the weekly roll-up; for a local test database only, safe to re-run.
Original plan:
- Days of supply per product (quantity and usual dose, override per product), refills per medicine, the message naming the medicine, and a prompt to offer a longer supply.
- Availability check: a due medicine that is out of stock or short-dated goes to the purchase suggestions before the call.
- Needs a decision on where dose data comes from (typed once per product, taken from the prescription, or learned from repeat purchases).

### Step 5 - Retry and escalation - BUILT 2026-11-19
As built, on the alerts engine, with no migration (the rules are created for each business by `ensureDefaults`): rules in `customer-followup-ladder.ts` (10 tests) and two alert kinds in the pharmacy `refills` module, both editable in Settings > Alerts. **Customer to try again** (`followup_retry`): for a customer's latest contact (last 30 days, still inside its return window, no purchase since, customer not marked do-not-contact or "no" to messages, not dues or review invites) with outcome no answer or call back later it tells the person who made the contact to **call again**, with outcome message sent to **nudge**, once the gap has passed (refill reminders 3 days, other contacts 5 days, both settings) and only until the number of tries since the customer's last bill reaches the limit (3, a setting). It links to the customer's page (the contact list hides a customer for the contact gap, so it could not be the link) and clears when the customer is contacted again or buys. **Contacted customers who did not come back** (`followup_lapsed`): once a week, when at least 3 (setting) customers' return windows ended in the last 7 days (setting) without a purchase, owners and managers get one alert with the count and up to three names, linking to the dashboard scorecard. English and Tamil texts added (the Tamil is a draft for a native speaker, like the rest). Decisions: a reminder is for a person; nothing is sent to the customer, because there is no sending service (WhatsApp messaging is still design-only), so "automatic sending only if the shop switches it on" is not built.
Checked on a scratch copy of `rgp_qa` with planted contacts and `POST /alerts/run`: a call-again and a nudge for the right person, none for a contact too recent, one with the tries used up, or a do-not-contact customer; the weekly roll-up for three lapsed customers went to the business head; a new contact cleared the alert; the two kinds and their settings are listed. Not done: a Playwright spec, an escalation to a named manager of the store (the roll-up goes to every owner and manager), per-audience retry gaps beyond refill and other, and a ladder for dues.
Original plan:
- A rule per audience (for example: no answer on day 3, then WhatsApp, then flag to the manager on day 7), run by the alerts engine. Reminder to the person first; automatic sending only if the shop switches it on and consent allows.

### Later
- Household-level call (one call for the family's refills), which depends on the household work.
- Customer replies (STOP, next week, changed shop) updating the log.
- A weekly manager review of lapsed customers using the recorded reasons.

## 6. Open questions

1. A fixed window (7 and 14 days) or each customer's own usual gap?
2. Should staff see only their own scorecard, or the store's as well?
3. Is the second nudge automatic (WhatsApp) or a reminder for the person to send?
4. Where should dose data for step 4 come from?
5. Should the refill screen stay as its own page once it shares the log, or become a tab of the worklist?

## 7. Risks

- **Merging the logs touches live data.** Run the copy on a scratch copy of the production database first (see the prod migration notes), keep `refill_followup` readable for a release, and keep the rollback.
- **Attribution disputes.** One rule (latest counted contact), stated on the screen. Never shown as a ranking.
- **Messaging limits.** Daily contact cap and consent stay as they are; the dashboard never bypasses them.
- **Small numbers.** A store with few contacts will swing the percentage; show counts beside every percentage, and hide the baseline lift when either group is under about 20 customers.
