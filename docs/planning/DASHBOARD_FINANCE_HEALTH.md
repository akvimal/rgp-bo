# Dashboard round 2: standard views by role, financial dashboard, sales patterns, richer health score

Status: **decisions taken 2026-11-14; F1 (findings engine) and F2 (sales patterns) built, uncommitted; F0 and F3 to F6 not built.** Decisions: accrual-style profit with a cash switch; the severity table as written (any Critical forces "Act now"); no cost of goods or profit for managers; the digest goes by both Telegram and e-mail (built with F6); start with F1 and F2.

Built (F1): migration `200_health_findings.sql` (`health_finding_state`, `health_snapshot`); `dashboard-findings.ts` (pure: severity, ageing, scoring, status, fix-first, store matrix, snooze rules) and `dashboard-findings.service.ts` (providers: 15 alert kinds the business has on, the old ratio checks when they cross a threshold, overdue payables and over 60 days, drawer differences, digital payments not checked, stock expiring in 30 and 90 days, fast movers out of stock, owner logins without two-step sign-in); `GET /dashboard/findings`, `POST/DELETE /dashboard/findings/snooze`; `app-health-findings` card above the old measures card. Built (F2): `sales-patterns.ts`, `GET /dashboard/metrics/patterns?category=`, `app-sales-patterns` card. Not yet in the findings: scheduled-drug sale without prescription detail, bill-correction spikes, ITC at risk from 2B, backup status (no record of it is kept), per-store filtering of the stock and expiry findings (the stock view has no store).
 Builds on `DASHBOARD_AND_MENU_DESIGN.md` (views, anatomy 6A), `DASHBOARD_RECOGNITION_IMPLEMENTATION_PLAN.md` (health, compliance register), `FINANCE_STATEMENTS.md` (double-entry layer, deferred) and `GST_SALES_REPORT.md`.

## 0. Where we are

| Area | Built | Gap |
|---|---|---|
| Views by role | Owner, Manager, Staff, Personal widget lists (`dashboard-view.ts`); tiles with comparison; sales trend, categories, customers, deliveries, expenses, payables, busy hours (data only: weekday x hour over 90 days) | Counter view thin; widgets are hand-placed per page, not one registry with one frame; filters differ per card; no common period/compare bar |
| Health | 7 core checks + 6 optional, each 0-100, weighted into one score; "held at Watch" when one check is weak | One number hides what is wrong; no severity, no list of *what* failed, no money at stake, no trend, no "fix this first"; averaging lets a legal failure vanish behind good sales |
| Money | Expenses by category with `cost_group`; payables ageing; sales by category | No place that shows **all** money in and out by category across months; no stock value / expiry value on the dashboard; no hour/weekday/day-of-month/month patterns beyond the 90-day heat map |

## 1. Standard dashboards by role

The anatomy (6A) is decided; what is missing is that **every widget is built the same way**. Proposal:

1. **One page shell** for all views: title row, scope bar (store, period, compare, "updated hh:mm"), needs-you-now strip, hero, tiles (max 6), primary chart, secondary grid, footer note "what this view never shows".
2. **One widget contract**: `{ key, title, definition, roles[], pack?, module?, source endpoint, drill link, empty text }`. The page renders only what the server's view list returns; a widget not allowed is absent. Each widget fails and loads on its own (skeleton, error with retry).
3. **One filter bar, saved per user and in the URL**; all widgets obey it (today some are fixed at 14 days or "this month").
4. **Role matrix** (what each view holds; M = margin/cost, owner only):

| Widget group | Owner | Manager | Staff | Counter | Personal |
|---|---|---|---|---|---|
| Needs you now | business-wide | store | mine | this shift | mine |
| Health (section 4) | all stores, by store | own store | no | store goals only | no |
| Sales tiles and trend | yes + M | yes, no M | my bills | shift today | no |
| Sales patterns (section 3) | yes | yes | no | no | no |
| Financial dashboard (section 2) | yes (the home of it) | expenses and cost ratios of own store only | no | no | no |
| Stock value, expiry, dead stock | yes | own store | no | no | no |
| Payables, GST position, bank | yes | payables due only | no | no | no |
| Cash, shifts | yes | yes | no | mine | no |
| People, compliance, badges | yes | yes | mine | shared | mine |

5. **Accountant view** (later): Financial dashboard, GST, payables, bank status, read-only.
6. Needs doing first: grant the Counter and Personal roles their dashboard path; Counter view built to the same kit.

## 2. Financial dashboard

### 2.1 The idea: classify every rupee once, then aggregate

Right now each module keeps its own categories (expense category, product category, payment mode). The dashboard needs **one classified stream of money events**. Proposal: a read-only **`money_flow` view** (SQL view or materialised table, no new data entry) that unions the existing sources into rows of `(date, store, direction, class, category, amount, source, source_id, basis)`, plus a small **`flow_category` mapping table** (source category to class, group, display name, optionally to a ledger account for the later journal layer).

| Class | Group / category | Comes from |
|---|---|---|
| Income | Sales by product category (net of GST), other income | sale lines; income entries |
| Income reduction | Returns, discounts | returns; discount on lines |
| Cost of goods | Purchases by product category; stock-out reasons (expiry, damage, sample, gift, own use) | purchase invoices; write-offs, adjustments |
| Operating cost | Premises, People, Operations, Technology, Compliance and finance, Marketing, Other (already `cost_group`) | expenses |
| People | Salaries, incentives, staff credit written off | HR/payroll |
| Finance cost | Bank and gateway charges, interest | bank import, Paytm reconciliation |
| Tax | GST output, input credit, paid to government | GST module |
| Capital and owner | Drawings, capital, loans, equipment | manual entries, expenses flagged capital |
| **Transfer (excluded from profit)** | Cash to bank, vault, inter-store transfers, shift float | cash ledger, transfers |
| **Unclassified** | anything with no mapping | shown as its own row with a count and a "classify" link |

Rules that keep it trustworthy:
- **Transfers are never cost or income** (the most common way home-made dashboards go wrong).
- **Two bases, one switch:** *Accrual-style* (invoice or bill date; the default for profit) and *Cash* (payment date; the default for cash view). Each page states which it shows.
- **GST kept out** of sales and cost (own class); a switch shows tax-inclusive for the owner who thinks that way.
- **Confidence line** on every figure (as in `FINANCE_STATEMENTS`): unclassified share, products without cost, bank not reconciled to date.
- Bank-statement lines (import already built) get categories by **rules on narration/payee** with "remember this" so classification improves; a line is classified once and the choice is audited.
- This is a **reporting layer, not the books**. It is built so its mapping can feed the double-entry journal later without redoing it.

### 2.2 What the page shows

1. **Filter bar**: store, period (month, quarter, financial year Apr-Mar, custom), compare (previous period, same period last year), basis (accrual / cash).
2. **Headline tiles**: Sales, Gross profit and %, Operating cost and % of sales, Operating profit, Cash in bank + tills + vault, Stock value at cost.
3. **Profit bridge** (waterfall): Sales to Cost of goods to Gross profit to each cost group to Operating profit. Click a bar to its category list.
4. **Category x period matrix** (the main ask): rows = categories (grouped, collapsible by class), columns = months (or quarters, or FY), then Total, % of sales, change vs compare. Heat shading on rows that moved most; sparkline per row; click a cell for the transactions behind it; export to Excel. Same matrix for **product category sales and purchases** (what sells vs what is bought).
5. **Cost ratios against sales** over 12 months (rent %, salary %, etc.) with a band for "usual", so a creeping cost is visible.
6. **Cash**: balance by place (tills, vault, bank), money in and out by class for the period, projected cash for 30 days from payables due and average sales (labelled an estimate).
7. **Stock value block** (own section, also on the Manager view for the store):
   - Total at cost and at MRP; by product category and by store.
   - **Expiry ladder**: value expiring in 0-30, 31-60, 61-90, 91-180 days; already expired on shelf in red; click to the batches. Vendor take-back possible flag (from the expiry revamp).
   - Dead stock (no sale in 90 days) value and %; excess (cover over N days) value; stock-outs on fast movers; stock turns and days of cover; GMROI per category (owner only).
8. **Working capital**: stock + receivables (customer dues, vendor advances) - payables, trend by month.
9. **Payables ageing** (existing) and **GST position**: output tax, input credit, net payable, return status, ITC at risk from unmatched 2B.

### 2.3 Build notes

- Query cost: 60k+ bills and growing; add **`metric_daily`** (business, store, date, class, category, amount) filled nightly and for today by live query; the matrix reads the roll-up. Index `bill_date`, `invoice_date`, `payment_date`.
- All amounts in the existing Indian format; FY starts 1 April; periods in the store's time zone (IST).
- Margin and profit are **owner only** (decided 2026-10-25); a Manager sees expenses and ratios for their store but not cost of goods or profit.

## 3. Sales patterns: hour, weekday, day of month, month

One card with four tabs, each answering a staffing, buying or cash question. All work on bills and sales value, with the store and period filters.

| Tab | Chart | Shows | Decision it helps |
|---|---|---|---|
| **Hour of day** | bars by hour (bills and value), plus weekday x hour heat map (exists as data) | peak 2-hour window and its share ("6-8 pm = 24% of sales") | who is on the counter when; when to run deliveries |
| **Weekday** | bars Mon-Sun, **average per day** (not total, so months with five Sundays do not mislead) | strongest and weakest day | rota, promotions, stock arrival day |
| **Day of month** | line/bars for day 1-31 as an index (100 = average day) | salary-day and pension-day spikes (1st-10th), month-end dip | reorder timing, cash planning, refill call timing |
| **Month of year** | 12 bars as a seasonality index over 24+ months, YoY lines | monsoon / festival / fever-season peaks, by category | buying plan, season stock-up, expiry risk |

Rules: exclude closed days and days before a store opened; show the **number of days behind each bar** and grey out thin bars; default window 12 months for hour/weekday/day-of-month and 24-36 months for month-of-year; allow filter by product category (cold and cough peak in different months); an auto-written sentence under each chart ("Saturdays are 18% above your average; Tuesdays 14% below"). Later: festival and holiday markers from the calendar.

## 4. Health score: more minor and major issues, compliance failures

### 4.1 What is wrong with it today

- Seven averaged ratios. One expired-licence or missing-register failure is outvoted by good sales; a score of 82 can hide a legal breach.
- It does not say **what** is wrong, **where** (which store, which bill), **how much** money is at stake, **how long** it has been open, **who** should fix it.
- No severity, no trend, no "do this first".

### 4.2 Proposed model: findings with severity, rolled up to areas

Every check becomes a **finding provider** that returns a list of findings (not just a score):

`{ code, area, severity, store, count, amount_at_risk, first_seen, owner_role, link, can_snooze }`

**Severity**
| Level | Meaning | Examples |
|---|---|---|
| **Critical** | legal breach, direct loss, or something that stops trading | licence or pharmacist registration expired; scheduled-drug sale without prescription detail or register line; selling above MRP; expired batch sold; backup failed or none for 48 h; GST return past due date; shift open over 24 h |
| **Major** | money leaking or a compliance duty late | cash short beyond tolerance; digital payments unmatched; bank not reconciled 30 days; payables overdue; stock audit overdue; ITC at risk from unmatched 2B; fast mover out of stock; expired stock still on shelf; compliance item escalated |
| **Minor** | hygiene, drifting, or small | mobile capture below aim; products without cost or HSN; outage kit unchecked; bill corrections high; discount creeping; refill calls missed; HR document expiring; unexplained shift variance |
| **Info** | worth knowing, no penalty | new vendor price rise; licence ending in 60 days |

**Aging:** a finding climbs one level if it stays open past its window (Minor after 14 days, Major after 7), the same ladder as the compliance register. **Legal items cannot be snoozed or waived by anyone but the Business Head**, and never past their date.

**Score:** per area = 100 minus points by severity (Critical 40, Major 15, Minor 3), with **diminishing returns** (the 5th minor of one kind counts half) and a floor of 0; business or store score = weighted mean of areas using the existing weights. **Status comes from the worst severity present**, not the average:
- any Critical: **Act now** (red) whatever the score;
- any Major: **Watch** (amber);
- Minor only: **Healthy, with notes**;
- none: **Healthy**.

The existing ratio checks (sales vs target, stock minimum cover, repeat rate) stay as **trend signals** inside their areas; they become findings only when they cross a threshold.

### 4.3 Catalogue of findings (first cut; every one has an on/off, threshold and owner role in Settings)

**Compliance and legal** - drug licence (expired Critical, 30 days Major, 60 Info); pharmacist registration; scheduled H/H1/X sale missing prescriber/patient detail (Critical); drug register line missing or edited (Critical/Major); expired batch sold (Critical); expired stock not quarantined (Major); GST return overdue (Critical), month not closed (Major); GSTIN missing on a business bill; wrong or missing HSN/GST rate; stock audit overdue (Major); compliance items late/escalated (from the register); waivers expiring; outage kit not checked (Minor).

**Cash and shifts** - shift open from an earlier day (Major, Critical at 24 h); cash short/over beyond tolerance (Minor, Major when repeated by the same shift or person); variance with no reason given; deposit overdue or vault variance (Major); digital payments unmatched (Major); bank not reconciled (Major); voids and bill corrections above normal (Minor, Major on a spike); cash-count shortfall at close.

**Sales integrity** - sale above MRP (Critical); below-cost sale; discount above the role's limit; discount or returns spike against the store's usual; price changed without approval; bills with no named server on a shared login; bills with no shift.

**Stock** - negative stock (Major); fast mover out of stock (Major); dead stock above x% of value; expiring value above x% (30/60/90); excess cover; products with no cost, zero MRP, flagged pack, or no HSN; count variance beyond tolerance; duplicate product names.

**Purchasing and payables** - overdue payables, and over 60 days; vendor price creep not reviewed; invoice total not matching lines; GRN or approvals waiting; purchase without GST invoice or unmatched in 2B (ITC at risk, with the rupee figure); vendor concentration over x%; PO older than its window.

**Customers and service** - mobile capture under aim; refill calls missed; failed or late deliveries; open complaints or feedback past their window; customer dues overdue.

**People** - attendance gaps; leave decisions pending; KPI not signed; staff credit overdue; HR documents expired.

**System and security** - backup failed or old (Critical); MFA off for owner roles (Major); inactive store; notification channel failing; unusual failed sign-ins; shared login on a Counter without operator naming.

(Where an alert or register item already exists it becomes the source of the finding; nothing is computed twice.)

### 4.4 How it looks

- **Health card**: ring with status and score, 12-week trend line, area bars (each area coloured by its worst severity), and counts "2 Critical, 5 Major, 11 Minor".
- **Fix first**: the top five findings ranked by severity then money then age, each with store, owner, how long open, **points recovered if fixed**, and one button to the screen that fixes it.
- **Drill**: area to findings table, filter by severity, store, owner, age; export; snooze (reason and date, not for Critical legal).
- **Owner**: all stores side by side (a small matrix of area x store, worst severity per cell). **Manager**: own store. **Counter/Staff**: shared goals only; no blame views.
- **Weekly digest**: the owner's Monday message (Telegram/e-mail) carries status, change since last week, new Critical/Major, and the fix-first list. The weekly review includes the same list.
- **Recognition link**: a store that clears all Majors for a month earns a *shared* store badge; findings are never used to rank individuals.

### 4.5 Data and build notes

- `health_finding` is computed, not stored per finding, except a **daily `health_snapshot`** (business, store, area, score, counts per severity) for trend and for "new since last week". Snoozes in `health_snooze` (finding code, store, reason, until, by).
- Providers are small pure functions over facts, unit tested like the current checks; the existing `combine()` keeps working for the ratio signals.
- Severity thresholds and weights live in the existing `health` config scope with floors (legal items cannot be set below Major).

## 5. Phasing

| Phase | What | Size |
|---|---|---|
| F0 | Widget contract + shell + common filter bar; Counter view; role matrix applied | M |
| F1 | Findings engine: model, severity, ~25 first providers drawn from data already held, area roll-up, status by worst severity, Fix-first list, snapshots and trend | L |
| F2 | Sales patterns card (hour, weekday, day of month, month of year) | S-M |
| F3 | `flow_category` mapping + `money_flow` view + Unclassified cleanup screen + category x period matrix with drill-through | L |
| F4 | Stock value, expiry ladder, dead/excess, turns; payables and GST position cards | M |
| F5 | Financial dashboard assembled: profit bridge, cost ratios, cash, working capital, confidence line, Excel export | M |
| F6 | `metric_daily` roll-up, targets per category, Monday digest, Accountant view; later the double-entry journal on the same mapping | M-L |

Suggested order: **F1 and F2 first** (largest visible gain, little new data), then F3 to F5, with F0 as the frame each new widget is built on.

## 6. Decisions needed

1. Financial dashboard basis: **accrual-style for profit, cash for cash view, with a switch** (recommended), or cash only?
2. Severity table (4.2 and 4.3): are the Critical items right? Is "any Critical forces Act now" acceptable, even when sales are excellent?
3. Who sees profit and cost of goods: owner only (as decided for margin), manager gets expenses and ratios only?
4. Findings feed the **weekly digest and Monday message**: yes/no, and by Telegram, e-mail, or both?
5. Start with F1 + F2, then F3 onward?
