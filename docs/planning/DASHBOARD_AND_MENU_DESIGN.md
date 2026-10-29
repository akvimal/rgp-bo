# Dashboard by role, and the left menu: review and design

Status: **review and proposal, not built** (2026-10-25). Related: `BUSINESS_TYPES_AND_PACKS.md` (widgets and menu items follow packs and modules), `CATALOGUE_KINDS_AND_CATEGORIES.md` (services and plans later add members and bookings to the same views).

---

**D0 built 2026-10-25 (uncommitted):** the dashboard now takes its scope from the signed-in user on the server. Owner roles see their business's stores; anyone else the stores they are assigned to (or the business's stores when none are assigned); a store outside that is refused with 403; sales, purchase invoices, payables, cash, shifts, returns and the customer and product trends use `sale.store_id` / `purchase_invoice.store_id` and the allowed stores; purchase orders, approvals and low stock (installation-wide, no store on the record) are sent only to owners and roles with the `purchaseorders` permission; customer names only to owners until the redesign replaces them with counts; an owner's admin counts are their own business's. QA `dashboard-scope.spec.ts` DS-1..5. Found on the way: **Sales Staff have no permission for the dashboard route**, so they never see a dashboard today (they land on the POS); a Counter view needs that path granted.

## 1. Review: what the dashboard is today

One page (`secured/dashboard.component.*`), fed by three calls: `/dashboard/summary` (about 15 live queries), `/dashboard/trends` (customers, top products) and `/dashboard/admin-summary`. About 20 cards in one fixed order, drawn with `@swimlane/ngx-charts`: 8 KPI tiles, sales trend (14 days), payment split, purchase trend, cash movement, PO approvals, customers served per day, top customers, top products by quantity and by revenue, pending approvals, overdue payables, low stock, open shifts, and for platform admins users by role and stores by business.

### Findings

| # | Finding | Why it matters |
|---|---|---|
| 1 | **The server does not scope the data.** `DashboardController.summary` ignores the signed-in user and takes the store from the query string. With no store it totals **every store of every business**; the purchase totals, payables, approvals and low-stock list have **no store or business filter at all**. | A Store Head or Sales Staff can read another store's sales by changing a URL; in an installation with more than one business the owner of one sees the others' purchases and payables. The role differences today exist only in the browser (`*isAuth`). This is the first thing to fix. |
| 2 | Sales are tied to a store through the **shift** (`store_shifts.store_id`), not `sale.store_id`, so a bill with no shift drops out of the totals. | Totals can disagree with the sales report. |
| 3 | **Role differences are accidental.** A card shows if the role holds a resource (`sales`, `purchaseorders`, `store`, `products`...). Sales Staff hold `purchases` and `store`, so they see purchase payables, the cash balance and deposit-due; the Business Head sees one long page with no order of importance. | A counter person gets data they do not need; an owner has to scan 20 cards to find what needs a decision. |
| 4 | **No comparison anywhere.** Each tile is a number (today, this month). There is no "versus yesterday, last week, last month or last year", no target, no arrow, no spark line. | A number alone does not say if it is good. The data goes back to Feb 2022 (61,847 completed bills on the prod copy), so year-on-year is possible and unused. |
| 5 | **Charts are static.** Bars and pies with a tooltip; fixed windows (14 days, this month); no period control, no click-through, no drill-down, no zoom. | The owner cannot ask the next question ("which day, which category, which staff") without leaving for a report. |
| 6 | **Little that supports decisions.** Nothing on margin, discounts, returns rate, stock value, expiry, dead stock, days of cover, payables ageing, cash short or over, staff comparison, GST position, or the open alerts and approvals the system already raises. "Users by role" and "Stores by business" are administration counts, not monitoring. | The data to decide (what to reorder, what to push, who to talk to, what cash to bank) is in the database but not on the page. |
| 7 | **Weak standards.** No visible "as of" time, no skeleton or empty state, hard-coded colours, no export, no persisted period, pies for a PO approval split of two or three slices, personal customer names on a page open to anyone with `customers`. | Not consistent with the rest of the app or with what people expect of a dashboard. |
| 8 | Every load runs about 20 queries over the whole history. | Fine at one store; slow with several stores and five years of bills. Needs daily roll-ups and a short cache. |

### The menu today (7 groups, 40 items)

Dashboard, then **Sell** (Sales, Customers, Inquiries, My shift, Outage kit, Refills), **Stock** (Store, Products, Stock audits, Drug register, Weekly review), **Buy & pay** (Purchase, Purchase requests, Vendor issues, Expenses, GST, Finance), **People** (My HR, Leave requests, Rate staff, My KPI, HR), **Oversight** (Reports, Staff & Quality, Digital payments), **Admin** (Settings, Businesses, Business details, Shop setup, Roles, Users, Delivery Partners, Notifications, Alerts, Store).

| Problem | Example |
|---|---|
| Groups mix jobs | Outage kit and Inquiries sit under Sell; Drug register and Weekly review under Stock; GST, Expenses and Finance under Buy & pay beside purchase requests. |
| "Store" is three different things | Stock > Store (stock), Admin > Store (settings), "My shift" (store cash). |
| Admin is a dumping ground of ten items, several of which are one-time setup | Business details, Shop setup, Roles, Users, Alerts. |
| Nothing says what needs attention | No counts for pending approvals, alerts, refills due, requests. |
| 40 items and no search | A new user hunts. |
| Names are inconsistent | Title case and sentence case, "Buy & pay" against "Purchase". |

---

## 2. Principles

1. **Three questions, in this order, on every role's page:** *What needs me now?* (an action strip), *How are we doing?* (tiles with a comparison), *Why?* (interactive charts that lead to the list behind them).
2. **The server decides what a role sees.** The view is chosen from the role, scoped to the user's business and stores; the client may only narrow within that.
3. **Every number is comparable and traceable.** A tile shows the value, the change against a chosen comparison, a spark line, and a tooltip defining it. Every chart element and tile opens the list or report behind it with the same filters.
4. **One filter bar for the whole page**: store, period, comparison. Clicking a chart element adds a filter chip that the other widgets obey (cross-filter).
5. **Role-appropriate depth.** Owner: the whole business and money. Store Head: one store and its exceptions. Counter: my shift only, no cost or margin.
6. **Fewer, better widgets.** A widget earns its place by changing a decision. No pies for two slices; no admin counts on an operating page.
7. **Pack-aware.** Pharmacy widgets (drug register coverage, refills due, licence and registration expiry) appear only where the pack is on; a non-pharmacy business sees its own.

---

## 3. The page: one shell, role-specific content

```
+----------------------------------------------------------------------------------------------+
| Owner view                         Store: [All stores v]  Period: [This month v]  Compare: [Last month v]   Updated 10:42 (refresh) |
+----------------------------------------------------------------------------------------------+
| NEEDS ATTENTION  [3 approvals] [2 payables due this week] [5 alerts: 1 critical] [Cash to bank: Main Rs 41,200] [GST: Sep not closed]  |
+----------------------------------------------------------------------------------------------+
| Sales        | Gross margin | Avg bill    | Returns      | Cash short/over | Payables due 7d |
| 12.4 L  +8%  | 21.3%  -0.6  | 410  +3%    | 1.8%  +0.4   | -120 (3 shifts) | 3.1 L (6 inv)   |
| ~~~spark~~~  | ~~~spark~~~  | ~~~spark~~~ | ~~~spark~~~  |                 |                 |
+----------------------------------------------------------------------------------------------+
| Sales and margin by day (bars + line, brush to zoom,     | Share of sales by category (treemap;    |
| dashed = comparison)                                     | click = filter the page)                |
|                                                          |                                         |
+----------------------------------------------------------+-----------------------------------------+
| Busy hours (heat map: weekday x hour)  | Payment mix + digital gap | Staff: bills, avg bill, discount  |
+----------------------------------------------------------------------------------------------------+
| STOCK HEALTH: value at cost | cover < 7 days (n) | expiring 90d (value) | dead 90d (value) | expiry ladder (bars by month) |
+----------------------------------------------------------------------------------------------------+
| PURCHASING: payables ageing (stacked)  | vendor share top 5 | price rises this month (n)  | open POs      |
+----------------------------------------------------------------------------------------------------+
| COMPLIANCE AND PEOPLE: licences ending | stock count overdue | drug register coverage | leave pending     |
+----------------------------------------------------------------------------------------------------+
```

Sections can be collapsed; the order is the role's, not fixed for all. A "table" toggle on each chart shows the numbers (accessibility and export).

### 3.1 Views by role (aligned with `RECOGNITION_AND_COMPLIANCE.md`, 2026-10-25)

Five views, one shell. Which one a person gets is a column on the role, never a list of ticked permissions.

| View | Role | Who it is | Scope | Purpose |
|---|---|---|---|---|
| **Owner** | Business Head, Owner-operator | the people who run the business | all stores, narrowable | decide: money, stock, compliance by item and store, waivers, recognition |
| **Manager** | Store Head | runs one store (or a few) | their stores | keep the store compliant and motivated: late items, waiver requests, the team's badges and thanks, today against usual |
| **Staff** | Sales Staff | a person with their own login | their own work | do the job and see their own progress: goals, badges, streak, their own items to finish, notes |
| **Counter** | Counter | a **shared** till login, with the person serving named on each bill | this counter and its shift | run the shift: who is serving, the shift's checklist, shared store goals, the lists; no personal figures or badges |
| **Personal** | Personal | a person who does not bill (HR self-service) | themselves | their attendance, leave, rating, documents and training, badges and thanks |
| **Platform** | Site Admin | the provider's staff | tenants | tenants, plans, usage (the control plane) |
| **Accountant** (later) | an external login | the books | the business | GST month, register, payables ageing, bank reconciliation, read-only |

### 3.2 Building blocks every view shares

| Block | What it is | Owner | Manager | Staff | Counter | Personal |
|---|---|---|---|---|---|---|
| **Needs you now** strip | the person's items by ladder step (reminder, due, late, required, escalated, blocked), one tap to act | store-wide counts, waiver requests, escalations | the store's late items, waiver requests sent, deliveries late, thanks to send | my own items | this shift's items (checklist, deposit) | my documents, training, leave |
| **Celebration** | a short thank-you the first time a badge is earned, with a link to the evidence | staff awards to recognise | the team's new awards, with "send thanks" | my new badge | a store goal reached (shared) | my new badge |
| **Goals today** | progress bars tied to the lists and habits | | the store's goals | my goals | the shared store goals | my goals (attendance, training) |
| **Badges and streaks** | habit badges with evidence, streaks that pause on a missed item | everyone's, no ranking | everyone in the store, in name order | my own | none (shared login) | my own |
| **Notes and thanks** | one-line notes from the heads | send and review | send to the team, receive from the Business Head | receive | store-level only | receive |
| **Compliance** | the register of what is owed | by item and store, with the ladder counts and waivers | the store's items, request a waiver, "not mine" | my items, "not mine" | the shift's items | my items |
| **Waivers** | time-limited, reason, expiry | **only the Business Head grants** | request | | | |
| **Numbers** | sales, bills, average bill and so on | whole business, margin | the store, no margin | mine against my usual | the counter's shift | none |

A **missed item of a person's own pauses their streak and new badges** and the view says so kindly; the **Counter** view cannot award personal badges because its login is shared: each bill carries the named operator, and recognition goes to that person and shows on their own Staff view.

---

## 4. Metrics (what is shown, how it is worked out, who sees it)

All money in the bill's tax-inclusive total unless stated; a registered business can switch to "excluding GST". Comparison choices: previous period, same weekday average of the last 4 weeks, same period last year.

| Group | Metric | Definition | Owner | Store | Counter |
|---|---|---|---|---|---|
| **Sales** | Sales | sum of completed bills in the period | yes | yes | mine |
| | Bills, average bill, items per bill | counts and ratios over completed bills | yes | yes | mine |
| | Discount given % | total discount over gross | yes | yes | mine |
| | Returns % | settled returns value over sales | yes | yes | |
| | Voids and edits | bills edited after completion, cancelled lines (the weekly review's facts) | yes | yes | |
| | Sales by hour and weekday | bills count and value grouped | yes | yes | |
| | Sales by category / by product (Pareto) | line totals grouped; cumulative share | yes | yes | |
| **Margin** | Gross margin % | (net of GST sale value less cost of goods) over net of GST sale value; cost per unit from the batch sold (`purchase_item.ptr_value` after discount and free quantity, over pack) | yes | optional | no |
| | Margin by category / product, below-cost sales | same, grouped; lines sold under cost | yes | | no |
| | Margin coverage | share of sales lines whose batch has a cost (so the figure is not overstated) | yes | | no |
| **Customers** | New versus returning, repeat rate | first bill ever in the period versus earlier | yes | yes | |
| | Refills due and called | refill follow-up counts (pharmacy pack) | yes | yes | mine |
| | Store credit and staff credit outstanding | balances | yes | yes | |
| **Stock** | Stock value at cost | balance x batch cost | yes | yes | |
| | Days of cover | balance over average daily sales of the last 30 days, by category | yes | yes | |
| | Stock-out and below reorder | products with balance zero or under minimum, with recent sales | yes | yes | |
| | Expiring in 30, 60, 90 days; expired on shelf | value at cost by batch expiry | yes | yes | |
| | Dead stock | value of products with no sale in 90 days | yes | yes | |
| | Negative stock, count overdue, audit variance | existing alert facts | yes | yes | |
| **Purchasing** | Purchases against sales | purchase invoices over sales | yes | | |
| | Payables, ageing, due in 7 days | unpaid balances in 0-30, 31-60, 61-90, over 90 days by due date | yes | | |
| | Vendor concentration | share of purchases of the top 5 vendors | yes | | |
| | Price rises, open POs, GRN waiting | the vendor receiving controls' facts | yes | yes | |
| **Cash** | Cash balance against threshold; deposit due | existing | yes | yes | |
| | Shift cash short or over | difference at shift close | yes | yes | mine |
| | Digital payments unmatched | provider statement against bills | yes | yes | |
| | Expenses by category | expense ledger | yes | yes | |
| **Accounts** | GST: month status, output tax, input credit, registration-limit watch | from the GST work | yes | | |
| | Bank reconciliation status | from Finance | yes | | |
| **People** | Attendance today, late, leave pending, staff credit | HR | yes | yes | self |
| | Pharmacist registration and licence expiry | existing alerts | yes | yes | |
| **Compliance** | Drug register coverage, outage kit checked | pharmacy pack | yes | yes | |
| **Alerts** | Open alerts by severity, approvals waiting | the alerts engine | yes | yes | mine |

**Data quality guards:** every ratio shows its coverage where the data can be incomplete (margin coverage; products with a wrong pack are excluded and counted); a customer's name is shown only to roles with the customers permission, and top customers are shown as a count and share rather than names unless the user opens the list.

---

## 5. Interactive charts

### 5.1 Library

Stay on **`@swimlane/ngx-charts`** (already installed, works with Angular 12). It has the types needed (combo bar-and-line, stacked and grouped bars, area with a timeline brush, heat map, tree map, gauge, linear gauge, pie and advanced pie, number cards), tooltips, legend toggling and `select` events. A thin wrapper component `app-chart-card` gives every chart the same frame:

- title, a definition tooltip, the period and comparison it is showing;
- loading skeleton, empty state ("no sales in this period"), error state with retry;
- "table" toggle and CSV export (PNG optional);
- click handling: `(select)` raises a filter chip or opens the drill-through;
- a colour palette from tokens (colour-blind safe), the same in every chart; light and dark themes.

A heavier library (ECharts) is held back: it would help brushing and large heat maps, but adds weight and a second way of drawing charts. Revisit only if ngx-charts limits a chart in use.

### 5.2 Chart set

| Question | Chart | Interaction |
|---|---|---|
| How are sales and margin moving? | combo: bars (sales) and line (margin %), comparison as dashed series, timeline brush | brush to zoom the period for the whole page; click a bar: that day's hour chart and bills |
| When are we busy? | heat map weekday x hour | click a cell: bills in that slot; informs staffing |
| What sells and earns? | tree map of categories (size = sales, colour = margin); Pareto bars with cumulative line for products | click a category: filters every widget; click a product: product page |
| How are customers paying? | donut (at most 5 slices) with digital-unmatched figure | click a method: bills by that method |
| Are we running out or overstocked? | quadrant scatter: days of cover (x) against sales rate (y), bubble = stock value | click a bubble: product and reorder action |
| What expires when? | bars by expiry month (value at cost), expired in red | click a bar: the batches |
| What do we owe and when? | stacked bars by ageing bucket, stacked by vendor | click a bucket: payables list filtered |
| Is cash where it should be? | linear gauge (balance against threshold) and a small line of the last 14 days | click: store cash page |
| How do staff compare? | horizontal bars (sales) with dots for average bill and discount % | click a person: their sales report (Store and Owner only) |
| Customers | stacked new and returning with repeat rate line | click: customer list for the day |
| Every tile | spark line, delta arrow in a consistent colour (up is good for sales, down is good for returns and discounts) | click: the report behind it |

### 5.3 Interaction rules

- The **global filter bar** (store, period, compare) is saved per user and written to the URL so a view can be shared.
- **Cross-filter chips** appear under the bar (for example "Category: Tablet x"); clearing one restores the page.
- **Drill-through** opens the existing list pages with the filters in the query string (the sales list, payables, stock, expiry and alerts pages must accept them; a small amount of work per page).
- Keyboard: every chart element is focusable; the table view is the screen-reader equivalent.
- Refresh: automatic every few minutes for the Counter and Store views, manual for the Owner view; always an "updated at" time.

---

## 6. Backend design

1. **Fix the scoping first** (small, independent): the dashboard takes the user's business and stores from the server; a requested store outside them is refused; all aggregates use `sale.store_id` and the business's stores; purchase, payables and approvals are filtered by business (and store where the table has one).
2. **One metrics API:** `GET /dashboard/view` returns the user's view definition (which sections and widgets, in order) and `GET /dashboard/widgets/:key?store=&period=&compare=` returns one widget's data. Widgets load in parallel and fail independently (one slow or broken widget does not blank the page). Responses carry `asOf`.
3. **Widget registry** in code: key, view(s), required permission, pack or module, query, definition text. A widget not allowed for the role or the business is not offered and is refused if asked for. This is also where pharmacy widgets are tied to the pack.
4. **Daily roll-up table** `metric_daily` (business, store, date, bills, sales, discount, returns, cost of goods, per category) filled by a nightly job and kept current for today by a short-lived query; comparisons over months and years read the roll-up. A 60-second cache per business, stores, period.
5. **Targets:** `metric_target` (business or store, metric, period, value) so tiles can show "versus target"; set on a simple screen by the Business Head.
6. **Role to view mapping** on the role record (`dashboard_view`), defaulting by role name, so a custom role gets a view and cannot widen the data.
7. **Scheduled digest** (later): the Owner view summarised by Telegram or e-mail each morning, reusing the notification channels already built.

---

## 6A. One standard layout for every view (decided 2026-10-25)

All five views, and every later one, are built from the same anatomy and the same components, so a person who moves between roles, or a business that changes a role's view, meets no surprises. The mock boards are being brought to this standard.

### Page anatomy (top to bottom, same order in every view)

1. **Header row**: page title ("Owner view", "Good afternoon, Staff 1"), the sample-data tag only in the mock; the role-view switcher exists only for owners and in Preview.
2. **Scope bar** (a white card): store, period (Today, 7 days, Month), comparison, with "Updated hh:mm". Views with no choice show it read-only (Counter: this counter and shift).
3. **Celebration slot**: shown only when a badge or goal was just earned; one line, one action ("Thanks"); never stacks.
4. **Needs you now strip**: counts as chips, then the list, by ladder step. Always directly under the scope bar, the first thing to act on.
5. **Hero**: one headline block for the role (Owner: store health; Manager: store health; Staff and Counter: goal ring; Personal: attendance).
6. **KPI tiles**: the role's numbers, six at most, each with value, change and what it is compared to.
7. **Primary chart or list** for the role.
8. **Secondary cards** in a responsive grid (two or three across, wrapping).
9. **Footer note**: one line saying what this view never shows.

### Components (one implementation each, used everywhere)

| Component | Rule |
|---|---|
| Card | white, 1px border #e6ebf5, 10 to 12 px radius, 14 to 16 px padding, title 16 px with a muted 12 px sub-title |
| KPI tile | title, value (22 px bold), change in green or red, and the comparison in grey; the whole tile opens the detail |
| Status colours | good teal, watch amber, bad rust, info blue, neutral grey; the meaning is always repeated in words or a mark, never colour alone |
| Ladder chip | Reminder, Due, Late, Required, Escalated, Blocked, Waived, Done: same colours and wording in every view and in the Inbox |
| Badge | a mark, a name and a state (Earned or progress); click shows how it is earned; same everywhere |
| Needs-you-now chip | a count then a label; a chip opens the list filtered to it |
| Table | sticky header on scroll, right-aligned numbers, 7 to 8 px row padding, sortable chips above it, horizontal scroll under 720 px |
| Chart | titled with what and against what, legend with toggles, click for the detail line below it, a text alternative |
| Empty state | one friendly sentence and, where it helps, the next action ("Nothing left to finish. Your streak is safe.") |
| Dialog | "Do this to continue": title, one row per item with action and reason, a clear primary button, "Not yet" |
| Terms | the business's own words (Medicine or Item, Customer or Patient) through the label service, in English and Tamil |

### Behaviour that is the same in every view

- Numbers: Indian digit grouping, amounts in rupees with k and L short forms, percentages with one decimal, dates as "Thu 24 Oct".
- Comparison default: against the person's or store's own usual; never against another person.
- Time: periods resolve in the store's time zone; "Updated" shows the data's age.
- Every figure that is clickable says so with a link style and a focus ring; every interactive control is a real button or link, keyboard reachable.
- Layout works at 360 px width: the sidebar becomes a menu button, cards stack, tables scroll.
- A widget that the role may not see is **absent**, not greyed.
- Loading shows the card frame with a skeleton; an error shows a message and a retry in the card, never a blank page.

### How it is built

A single Angular dashboard page renders a **view definition** (an ordered list of widget keys per role, from config) through a widget registry; each widget is a small component built on shared card, tile, chip, table and chart components under `shared/`. A new view, or a business changing the order of widgets, is configuration, not new screens. A widget declares the roles allowed to see it, so the server's gate and the registry agree.

## 7. The left menu

### 7.1 Principles

Group by **the job the person is doing**, not by the module's name; at most 8 groups and about 6 items in each; a group with no allowed item disappears; Setup is last and collapsed; counts on items that need action; a search box for everything; the same words in the menu, the page title and the permissions.

### 7.2 Proposed menu

```
HOME
  Dashboard                      (the view for the role)
  My shift                       (cash, till, handover)            [badge: shift open / not open]
  Inbox                          (alerts and approvals waiting)    [badge: count, red if critical]
  Reports

SELL
  Sales and billing              (point of sale, bills, returns, deliveries)
  Customers                      (history, credit)
  Refills                        (pack: pharmacy)                  [badge: due today]
  Requests and inquiries

INVENTORY
  Products and prices
  Stock                          (stock by store, adjustments, transfers, counts)
  Stock audits
  Outage kit
  Drug register                  (pack: pharmacy)

PURCHASING
  Orders and requests            (suggestions, POs)
  Purchase invoices              (receiving, GRN)
  Vendors
  Vendor issues
  Payables                       (what we owe, ageing)

ACCOUNTS
  Expenses
  Digital payments
  GST                            (registration, register, summary, rate changes, HSN)
  Finance                        (bank, reconciliation, records)

PEOPLE
  My HR                          (attendance, leave, KPI, pay)
  Staff and HR                   (staff records, attendance, payroll)
  Leave and ratings              (approvals, rate staff)

OVERSIGHT
  Compliance                     (the register: what is owed, by step; waivers)   [badge: late items]
  Weekly review
  Staff and quality              (grievances, discrepancies, recognition)
  Approvals
  Audit log

SETUP                            (collapsed; Business Head)
  Shop setup and business details
  Stores and cash policy
  Users and roles
  Alerts and notifications
  Delivery partners
  Businesses                     (platform only)
```

What moved and why:

| Item | From | To | Reason |
|---|---|---|---|
| Outage kit | Sell | Inventory | it is a stock and price continuity tool |
| Weekly review | Stock | People | it reviews staff actions (discounts, voids, returns) |
| Drug register | Stock | Inventory (pack) | a stock record kept per sale; pharmacy only |
| Expenses, Digital payments, GST, Finance | Buy & pay, Oversight | Accounts | all are money and books; one place for the accountant's login |
| Purchase requests | Buy & pay | Purchasing > Orders and requests | one flow |
| Vendor issues, Payables | Buy & pay | Purchasing | belong to buying |
| Reports | Oversight | Home | the first thing an owner opens after the dashboard |
| Staff and quality | Oversight | People | about staff and complaints |
| Notifications, Alerts | Admin | Home > Inbox (reading) and Setup (rules) | read in one place, set up in another |
| Business details, Shop setup, Store settings, Users, Roles | Admin | Setup (one page each, in order of first use) | setup is done once; keep it out of daily view |

### 7.3 Behaviour

- **Role-adaptive**: a Counter sees Home (Dashboard, My shift, Inbox) and Sell; a Store Head sees about five groups; the Business Head all but Setup collapsed.
- **Badges** from the alerts engine and approvals (Inbox, Refills, Payables due, Stock audit due, GST month).
- **Search / command palette** (Ctrl+K, or the box at the top): every page and common actions ("New sale", "Open shift", "Close GST month"), filtered by permission.
- **Remember** which groups are open; on narrow screens a bottom bar for the Counter (Sell, My shift, Inbox).
- **Pack and module aware**: items for a pack or module that is off do not appear (as today for modules).

---

## 8. Phasing

| Phase | What | Size | Notes |
|---|---|---|---|
| D0 | Scope the dashboard on the server (business, stores, `sale.store_id`); refuse a store outside the user's; filter purchase data by business | S | Security fix; do first, on its own |
| D1 | Shell: view by role, filter bar (store, period, compare), "needs attention" strip from alerts and approvals, KPI tiles with comparison and spark lines, widget registry, Owner and Counter views | M | Replaces the card page |
| D2 | Interactive charts set 1: sales and margin combo with brush, hour heat map, category tree map, payment donut, Pareto; chart frame component; drill-through to sales and reports | M to L | Margin needs the cost per batch and a coverage figure |
| D3 | Store view and Self view; staff comparison; returns, voids and cash-short widgets | M | |
| D4 | Stock health and purchasing health: expiry ladder, cover quadrant, dead stock, payables ageing, vendor concentration | M | Needs list pages to accept filters from the dashboard |
| D5 | Menu regroup, badges, search | M | Frontend only; the permission resources do not change |
| D6 | Roll-up table and cache, targets, CSV export, saved views, morning digest, Accountant view | M to L | When data volume or several stores need it |

D0 is a defect and should not wait for the design to be accepted.

---

## 9. Decisions taken (2026-10-25)

1. **Sales with GST** as the headline, with a switch to "excluding GST" for the owner and accountant views.
2. **Margin: owner only** (Business Head, Owner-operator). Not Store Head, not Counter.
3. **Staff comparison is shown** to the owner and the Store Head. A Counter person sees their own figures; no ranking of one person against another is shown to the Counter.
4. **Targets: yes.** The Business Head sets monthly sales targets per store, and tiles show against target.
5. **Menu: the eight groups** of section 7.2, with Setup collapsed.
6. **Customer names off the dashboard:** counts and shares only; names appear only after opening the customer list (which needs the customers permission).

Still open, with a default: the default period is month to date against last month; the library stays ngx-charts; the order of work is D0, then D1 with D5, then D2.
