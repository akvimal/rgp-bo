# Menu regrouping and fine-grained permissions

Status: **review and proposal; steps A, B and C built, the controller audit (E0) done and its first finding (the sales report) fixed 2026-11-16, uncommitted** (sections 7 to 11). Step D: Reports (section 14), HR (section 15) and the sensitive Purchasing actions (section 16) built 2026-11-16; the stock gate split (section 17); the full Purchasing split, and disposal, vault and cash, not built. Step E: Accounts (section 18), Setup (section 19), Customers (section 20) and the till overrides of Sales (section 21) built 2026-11-16; the rest of the Sales keys not built; scope on the grant (section 22) built for four screens; the grouped menu is the default (section 23). Related: `DASHBOARD_AND_MENU_DESIGN.md` (the eight-group menu this refines), `BUSINESS_TYPES_AND_PACKS.md` (packs and modules), `RECOGNITION_AND_COMPLIANCE.md` (waivers).

Scope of the review: `frontend/src/app/secured/menu.ts`, the Settings submenu in `secured.component.html`, the role editor's list (`settings/roles/permission-catalog.ts`), the route files, `auth.service.ts` (`isUrlAuthorized`), the API's `permission.guard.ts` / `permission.service.ts` / `role-rules.ts`, and `role-templates.ts`. **Not done:** a read of every API controller, so which endpoints enforce a permission and which only hide a button is still to be checked (step E0 below).

---

## 1. Findings

### 1.1 The menu and the role editor have drifted apart

- **Menu keys with no row in the role editor:** `gstfiling`, `finance`, `review`, `compliance`, `outage`, `scheduleregister`, `dashsetup`, `settings.read`. They can only be granted by SQL migrations and role templates.
- **Pages that borrow another permission:** Customer orders (`/secure/commitments`) is opened by `sales` (`menu.ts:41`, `auth.service.ts`); the Financial dashboard by `finance.view` or `expenses.approve`; Delivery Partners (Settings) by `purchases`. None can be granted or withheld on its own.
- **Actions the code checks but the editor does not list:** `paymentrecon.import`, `store.shift.open`/`shift.close` (in the editor, but not the page they gate), the `expenses` view/manage pair on some screens.
- **Group names differ:** the editor has 5 groups (Administration, Catalog & Purchasing, Sales & Store Operations, Staff & Quality, Reporting); the menu has 8. Expenses and Digital payments sit under "Staff & Quality" in the editor but under Accounts in the menu.

### 1.2 Several pages are in the wrong group

"Staff and quality" (`/secure/quality/*`) holds six unrelated things:

| Item | Is really | Belongs in |
|---|---|---|
| Refills | customer follow-up | Sell |
| Grievances | customer care | Sell (Complaints) |
| Staff credit | pay | People |
| Staff sales | staff performance | People |
| Cash & shifts | money exceptions | Accounts |
| Audit log | oversight / admin | Oversight |

Other symptoms:

- **Refills is shown only to people without `grievances.view`** (`menu.ts:42`); managers must open Staff & quality and find the tab. **Purchase requests** uses the same trick (shown only without `purchases.add`).
- **Settings is 12 flat items** mixing one-time setup, daily admin and integrations.
- **Three menu layouts** (classic, grouped, counter) name groups differently, so every new page is placed three times.
- Financial dashboard and Reports use the same icon (`bi-graph-up`).

### 1.3 Permissions are too coarse inside the big modules

| Module | Today | What it covers (cannot be split) |
|---|---|---|
| HR | `hr.view`, `hr.manage` | staff records, salary, payroll, bonus, attendance, leave, KPI, coaching, setup, assistant (9 tabs) |
| Purchases | `read`, `add`, `edit`, `vendors.edit`, `delete`, `request` | orders, invoices, payables, returns, GST reconciliation, suggestions, settings; payments and editing a completed invoice are hardcoded to the Business Head |
| Stock and cash (`store`) | `read` (PTR cost), `adjust`, `shift.open`, `shift.close` | stock, write-offs, expiry/out-passes, counts, transfers, vault, cash, shifts |
| Products | `price`, `add`, `edit`, `delete` | master, pricing rules, pricing policy, pack check, data check |
| Sales | `read`, `view`, `add`, `bill`, `void`, `forcevoid` | returns, deliveries, discounts, price override, credit sale and reprint have no keys |
| Customers | `read`, `delete`, `reveal`, `export` | no add/edit; dues, merge duplicates, credit limit, worklist and audiences are not separate |
| Reports | presence only | whether the page opens; cost and margin reports cannot be limited to the owner |
| Finance, GST | one `view` each | preparing, locking, unlocking, importing cannot be granted separately |

### 1.4 Page access is by path prefix

The browser grants `/secure/purchases` and everything beneath it (`matchesPath` in `auth.service.ts`). Finer control needs a path list per capability **and** an API check per action; hiding a button alone is cosmetic.

---

## 2. Proposed menu

| Group | Items |
|---|---|
| **Home** | Dashboard, To-dos, Calendar, Reports |
| **Sell** | Sales and billing, Customer orders, Customers, Refills, Complaints, Requests and inquiries, WhatsApp |
| **Inventory** | Products and prices, Price changes, Stock, Stock audits, Outage kit, Drug register |
| **Purchasing** | Purchase requests, Purchase orders, Purchase invoices, Payables, Vendors, Vendor issues |
| **Accounts** | Financial overview, Expenses, Digital payments, GST, Bank and records, Cash and shifts |
| **People** | Staff and HR, Attendance (mark, review), Leave requests, Rate staff, Staff credit, Staff performance |
| **Oversight** | Compliance, Weekly review, Audit log |
| **Setup** (collapsed) | Business (details, shop setup, stores, dashboards and compliance, AI); People and access (users, roles); Integrations and alerts (notifications, alerts, WhatsApp, delivery partners); Data (import/export, modules) |
| **Learn** | Pharmacy guide, App guide, Knowledge check, Help and feedback |
| **Profile menu** | My shift, My HR, My KPI (as today) |

Rules:

- **"Staff and quality" is retired**; its six tabs go where section 1.2 says.
- **Refills and Purchase requests** show to anyone holding their permission; the "hide if you hold the bigger one" workarounds are removed.
- **Purchasing** items become real entries instead of tabs inside one "Purchase" page.
- **One menu definition.** The counter layout hides groups rather than renaming them, so there are no second group names to keep in step.
- A group with nothing the role may open stays absent (as today).

---

## 3. Proposed permissions

Consistent verbs: `view`, `add`, `edit`, `delete`, `approve`, `export`, `manage` (settings). Existing keys keep their names; the table lists **additions**.

| Area | Keys to add (existing stay) |
|---|---|
| **Customer orders** (new resource `customerorders`) | `view`, `add`, `receive` (take advance), `deliver` (collect / hand over), `cancel` (with refund), `manage` |
| **Sales** | `edit` (completed bill), `discount`, `pricing.override`, `creditsale`, `reprint`, `returns.view`, `returns.add`, `returns.approve`, `deliveries.view`, `deliveries.manage`, `export` |
| **Customers** | `add`, `edit`, `dues.view`, `dues.collect`, `creditlimit.set`, `merge`, `worklist.use`, `consent.view` |
| **Refills** | `assign`, `export` |
| **Products** | `view`, `pricing.rules` (view, manage), `packcheck.resolve`, `import`, `cost.view` (explicit, instead of riding on `store.read`) |
| **Stock** | `stock.view`, `stock.adjust`, `writeoff`, `expiry.act`, `outpass`, `transfer.request`, `transfer.approve`, `transfer.receive`, `count.perform`, `vault.view`, `vault.deposit`, `cash.view`, `shift.review` |
| **Purchasing** | `requests.add`, `requests.approve`, `orders.view`, `orders.add` (approve, reject stay), `invoices.view`, `invoices.add`, `invoices.edit`, `invoices.complete`, `invoices.editcompleted`, `invoices.recalculate`, `payments.view`, `payments.record`, `returns.manage`, `vendors.view`, `settings.manage` |
| **Accounts** | `gstfiling`: `prepare`, `lock`, `unlock`, `export`. `finance`: `bank.import`, `reconcile`, `records`. `paymentrecon`: `import`. `financials.view` (own key). |
| **HR** | `staff.view`, `staff.manage`, `pay.view` (salary), `pay.manage`, `payroll.run`, `payroll.approve`, `attendance.manage`, `leave.manage`, `kpi.setup`, `bonus.manage`, `coaching.manage` |
| **Reports** | `reports.sales`, `reports.margin` (owner only), `reports.purchases`, `reports.stock`, `reports.staff`, `reports.ask` (AI), `reports.export` |
| **Oversight** | `compliance.view`, `compliance.waive` (Business Head only), `review.view`, `review.acknowledge` |
| **Setup** | `deliverypartners.manage` (replaces borrowing `purchases`), `configtransfer.export`, `configtransfer.import`, `modules.manage`, `users.resetpassword`, `users.mfareset` |

Sensitive data is granted separately from page access: **cost, margin, salary, full phone numbers**, and the actions **unlock GST, waive compliance, force void, edit a completed invoice**. These stay with the Business Head unless explicitly delegated.

---

## 4. How to build it

1. **One registry.** Today the menu (`menu.ts`), the role editor (`permission-catalog.ts`), the route check (`permissions.json` / role JSON paths) and the API (inline `can(...)` calls) each carry their own list. One registry lists each capability once: key, label, group, paths, pack or module it depends on, and who may delegate it. Menu, route guard and role editor read it. A unit test fails if a menu key is missing from the editor (it would have caught every gap in 1.1).
2. **Compatibility migration.** Each new key is granted to every role holding the old one (`hr.manage` becomes all HR keys; `sales` becomes the Customer orders keys). No role loses access on day one; owners narrow roles afterwards. Roles are stored as JSON on `app_role.permissions`, so this is one SQL migration per split with a rollback.
3. **Role editor.** Groups match the menu. Presets (Counter, Store manager, Accountant, Purchase staff) with a "Customize" toggle for individual keys; a one-line "what this opens" on each key.
4. **Scope on the grant.** "View (own, or their store)" is today written into labels. Make scope a setting of the grant: own, store, business.
5. **Delegation rules.** Every new key is classified in `role-rules.ts`: which a Store Head may pass on (`MANAGER_CAN_GIVE`, `overreach`), which are owner-only, which are platform-only.
6. **API enforcement.** Each new key needs a check on its endpoints, not only a hidden button. This is the largest part of the work and the main risk.
7. **Pack and module awareness.** Keys that belong to a pack or a switched-off module (refills, drug register, payment reconciliation, GST, stock audits, transfers) are not offered in the role editor for a business that has them off.

---

## 5. Phasing

| Step | What | Size |
|---|---|---|
| A | Add the missing rows to the role editor; give Customer orders (`customerorders`) and Delivery Partners their own keys; regroup the editor to match the menu | S |
| B | Menu regroup: retire "Staff and quality", move its six tabs, remove the hide-if-bigger-permission workarounds, split Settings into four sub-groups, one menu definition for all layouts | M |
| C | The registry, with the menu-versus-editor test; routes and role editor read it | M |
| E0 | Audit every API controller: which endpoints enforce which permission; list the ones that only hide a button | S |
| D | Split HR, Purchasing, Stock and Reports (with compatibility migration, API checks, QA cases) | L |
| E | Split Sales, Customers, Accounts, Setup; scope on the grant | L |

A and E0 are independent and low-risk; do them first. QA cases are needed per split: a role holding only the new narrow key can do that and nothing else.

---

## 6. Open questions

1. **Customer orders split**: are `receive`, `deliver`, `cancel` the right cuts for the counters, or is one `add` plus `manage` enough?
2. **Complaints** (grievances): move to Sell, or keep with oversight under a manager-only permission?
3. **Staff performance and Cash & shifts**: People / Accounts as proposed, or together under Oversight as "exceptions"?
4. **Reports**: one permission per report family as listed, or per individual report?
5. **Presets**: which role presets should ship (Counter, Store manager, Accountant, Purchase staff exist partly in `role-templates.ts`)?

---

## 7. Step A built (2026-11-16, uncommitted)

What changed:

- **Role editor catalogue** (`settings/roles/permission-catalog.ts`): new rows for the pages the menu already asked for but the editor could not grant: `gstfiling`, `finance`, `compliance`, `review`, `outage`, `scheduleregister`, `dashsetup`; the missing `paymentrecon.import` action; and two new resources, `customerorders` (`view`, `manage`) and `deliverypartners` (`manage`). The editor's groups now follow the menu (Home, Sell, Inventory, Purchasing, Accounts, People, Oversight, Setup, Learn); the old five groups are gone.
- **Customer orders** has its own permission. `view` is what the till did before (see, take an order and an advance, collect it on a bill); `manage` is what only a Store Head or the owner could do (pay an advance back, cancel). The API enforces it: a guard on the commitments controller (`commitment.guard.ts`; `GET /commitments/waiting/:productid`, which purchasing uses, stays open to any signed-in user as before) and the manager check in `commitment.service.ts` now reads the `manage` grant instead of the role name. The owner roles always have both.
- **Delivery partners** has its own permission. Everyone signed in can still read the list (the delivery screens need it); add, change and remove need `deliverypartners.manage`. This also closes a gap: the API let any signed-in user change partners.
- **Migration 208** (`208_customer_orders_delivery_partners_permissions.sql`, rollback `208_rollback.sql`): `customerorders.view` to every role that holds `sales` (plus `manage` for Business Head, Owner-operator, Store Head); `deliverypartners.manage` to those three and to any role holding `purchases` add or edit, and the page added to the role's settings block. Nobody who had a page loses it, except a role that held only `purchases` read or `request` (Sales Staff with purchase requests) and used to see the Delivery Partners link by accident. Checked on a throw-away Postgres (PGlite) with seven mock roles: grants as intended, a second run adds nothing, rollback removes everything it added. **Not yet run on a real database.**
- **Menu and route check**: the Customer orders entry and route use the new key (the special case in `auth.service.ts` that borrowed `sales` is gone, the role's own path now carries the page); the Settings > Delivery Partners link uses `deliverypartners.manage` instead of `purchases`.
- **Tests**: `menu-permissions.spec.ts` fails if a permission the menu asks for has no row (or no such action) in the role editor, if a row is in no group, or if a resource is listed twice; `commitment-access.spec.ts` covers who may use and manage customer orders. Menu specs 8 of 8 pass (Karma, headless Chrome; needs `NODE_OPTIONS=--openssl-legacy-provider` on this machine), API specs pass, both projects type-check.

Not done in step A: the Settings submenu and the sidebar groups are unchanged (step B); the Playwright QA suite was not run (Docker was not running, and the QA bootstrap's migration list stops at 122); the per-action splits (`receive`, `deliver`, `cancel`) are left for the open question in section 6.

---

## 8. Controller audit (E0), 2026-11-16

A survey of the 78 API controllers and their services, not a line-by-line review: for each module, which kind of check guards it. **Not checked line by line:** the alerts and settings controllers, vault and store writes, stock disposal, the dashboard's 34 endpoints, and whether any other code builds SQL from request values the way the sales report does (see 8.1).

### 8.1 Needs attention first

1. **(Fixed, section 10.) `POST /reports/sale` was open to any signed-in user and builds its SQL by pasting request values into the query** (`reports/report.service.ts`: `begin`, `end`, `product.category` and the property ids and values are concatenated into the statement). It has no permission check, no business or store scope, and returns customer names and mobile numbers with every bill line. Two problems in one: any signed-in role can read every sale of every business, and the pasted values allow SQL injection. The `reports` permission only decides whether the page opens. **Fixed 2026-11-16, see section 10.**
2. **The role editor offers permissions the API ignores.** `hr` (view, manage), `staffcredit`, `grievances` and `refills` are in the editor, but the API decides by role name: HR and staff credit are `Business Head` only (`HrGuard`, `staff-credit.service.ts`); grievances are the owner roles and Store Head; refills are the owner roles, Store Head and Sales Staff. Ticking those boxes for a custom role shows the page and the API then refuses (or, for the role names, allows regardless of the box). Same for compliance (manager roles by name) and the Quality tabs Staff sales and Cash & shifts (`ALLOWED_ROLES`).
3. **Customer orders and Delivery partners** (fixed in step A, section 7).

### 8.2 How each module is guarded

| Style | Modules |
|---|---|
| **By permission** (`PermissionGuard`, `PermissionService`, `PurchasingGuard`) | purchasing: purchases, vendors, orders, invoices, payments, returns, suggestions (`PurchasingGuard`, 11 controllers); products (price, add, edit, cost); stock and store (adjust, shift open and close); GST reconciliation (`gst` read, import, reconcile, lock) and GST filing; finance; weekly review; outage kit; drug register; roles and users; businesses; vendor issues; expenses; WhatsApp; stock audits; inquiries; payment reconciliation; calendar, to-dos, feedback; customer orders and delivery partner writes (step A) |
| **By role name** (hardcoded `Business Head`, `Store Head`, `Sales Staff`, `isOwnerRole`, `isManagerRole`) | HR and KPI (Business Head only), staff credit, grievances, refills, compliance, Quality tabs, customer delete / merge / credit corrections, sales (force void, returns settings, manager screens, deliveries), the dashboard (by role and store), AI settings, config import/export, recognition, knowledge, messaging |
| **Signed in only, nothing else** | the sales report (8.1), delivery partner reads (intended), lookup, files, documents/export (guard not found on one export route: worth a look); the settings, alerts, vault and store write endpoints were not read in detail |

### 8.3 What it means for the later steps

- **D and E need an enforcement change, not only new keys.** For each split (HR, purchasing, stock, reports, sales, customers) the role-name checks above have to become permission checks first, or the new keys do nothing. Order: reports (8.1), then HR and staff credit, then grievances / refills / compliance / Quality tabs, then the rest.
- **Keep the owner roles as a floor** (as `commitment-access.ts` does): the Business Head and Owner-operator always pass, so a mis-saved role cannot lock the owner out.
- **Scope stays a separate check.** Many role-name checks are really store scope ("their own stores"); the permission decides whether a person may use the feature, the existing store scope still decides which stores.

---

## 9. Step B built (2026-11-16, uncommitted)

**Rollout:** the grouped menu is still the per-business choice (`views.new_menu`, default off) and always on for the counter roles. Step B changes what the grouped menu contains; it does **not** switch any business over. To roll out: set `views.new_menu` on for a business (Settings > Dashboards and compliance), or flip the default in `api-v2/src/core/config/config-schema.ts` (`b('views', 'new_menu', ...)`) and update QA MG-1, which asserts "off by default". The old hard-coded menu in `secured.component.html` is untouched and still serves the businesses that stay off; it should be deleted once none do (that is the rest of "one menu definition").

What changed:

- **`secured/menu.ts`** (the grouped menu, and the counter layout derived from it):
  - "Staff and quality" is gone; its six pages are entries under their job: **Sell** gets Refills and Complaints; **Accounts** gets Cash and shifts; **People** gets Staff credit and Staff performance; **Oversight** gets the Audit log. Routes are unchanged (`/secure/quality/...`).
  - **Price changes** moved from Sell to Inventory; the **Financial dashboard** now opens Accounts.
  - The hide-if-the-bigger-permission workarounds are gone: Refills shows to anyone with `refills.view` (it was hidden from anyone who could open grievances), Purchase requests shows to anyone with `purchases.request` (it was hidden from anyone who could add purchases).
  - The counter layout places the new entries in its own groups (Sell, Money, People); the audit log goes to "More" with Reports and Compliance, as before.
- **Quality pages** (`quality-shell.component.ts`, new `menu-mode.service.ts`): in the grouped menu the page shows its own heading (Complaints, Refill follow-up, Staff performance, Staff credit, Cash & shifts, Audit log) and no strip of tabs; in the old menu it keeps "Staff & Quality" and the tabs.
- **Settings submenu** (one place, used by both menus): four labelled sub-groups, **Business** (Businesses, Business details, Shop setup, Store, Dashboards and compliance, AI assistant), **People and access** (Users, Roles), **Integrations and alerts** (Notifications, Alerts, WhatsApp, Delivery partners), **Data** (Import and export, newly reachable from the menu). A sub-group label shows only if one of its entries does.
- **App guide:** the "Staff and quality" page is replaced by one page per entry above; Price changes is under Inventory.
- **Tests:** `menu.spec.ts` covers the six pages (each under its group, same route, shown for its own permission only, no longer hidden by a bigger permission, in the counter layout), and fails if the app guide has a page for a menu entry that no longer exists. Whole frontend unit suite 87 of 87, development build compiles. QA specs updated to match (MG-2, REFILL: no tab strip for the counter) but **not run**: Docker was off here.

Not done (from the step B list): Purchasing is not split into direct entries for Orders, Invoices, Payables and Vendors; the Purchase page keeps its tabs, because the tabs carry the purchasing-level and GST module rules and the QA specs click through `nav-purchases`. This can follow when Purchasing is split in step D. The old menu is not removed (see Rollout).

---

## 10. The sales report fixed (2026-11-16, uncommitted)

`POST /reports/sale` (finding 8.1.1) now:

- **Needs the Reports page.** `@Permission('useReports')` on the route: the Business Head and Owner-operator by name, any other role only if the role editor gave it the Reports page (`PermissionService.canUseReports`; the permission has no actions, only its presence, so a `reports:<action>` check could never pass). The Store Head is not let in by name: the editor decides. Sales Staff, Personal and the platform's Site Admin are refused with 403.
- **Reads only the person's stores.** `core/store-scope.ts` (`storesVisibleTo`) works the stores out on the server: all the business's stores for an owner role; the assigned stores for anyone else, or the business's stores when none are assigned; no limit only for a login with no business. Bills are matched on `coalesce(sale.store_id, shift.store_id)`, the rule the staff summary already uses. This is the same rule as the dashboard's `scope`, which was left as it is.
- **Builds no SQL from the request.** `sale-report-query.ts` puts the dates, category and each property id and value in query parameters and checks the shape first: the report must be `sale`, dates must be real `YYYY-MM-DD` dates and in order, at most 20 properties, texts at most 200 characters; anything else is a 400. Empty or unticked property values are skipped, as before. The unused `ReportService.customerOrders` (which pasted an id into SQL, and nothing called) is removed.

Checked: 28 new unit tests (the builder with injection strings, the store rule, the permission), the whole API suite (1,249 pass), and the generated SQL run on a throw-away Postgres (PGlite) with four sample bills: an owner of stores 1 and 2 gets those bills and not another business's; a person on store 1 gets only store 1; a bill that only its shift ties to a store is found; no stores gives nothing; a draft bill is never listed; category and property filters work; an injection string in the category, property id or value matches nothing and the table is intact. QA cases RPT-5 (no Reports page: 403) and RPT-6 (bad dates 400, injection-shaped filter matches nothing) added to `reports.spec.ts` but **not run** (Docker was off).

Still open on this endpoint: the report returns the customer's full mobile number next to the name to anyone who may open it. The sale list and the customers screens mask phone numbers for roles without `customers.reveal`; the report does not. Not changed, because it would change what existing report users see; say if you want it masked the same way. The same holds for no row limit on a search or an export. And the audit's wider question is unchanged: other places may build SQL from request values (not scanned for).

---

## 11. Step C built: the registry (2026-11-16, uncommitted)

**One list of every permission**: `frontend/src/app/@core/auth/permission-registry.json`. Each resource has its key, label, description, group, page paths, actions (with their labels and fixed properties) and, where it depends on one, the business module (`availability`). It was made from the role editor's catalogue and now replaces it as the source; the other places read it.

- **Role editor:** `permission-catalog.ts` is a typed view of the registry (same exports, so the editor is unchanged). Adding or changing a permission is an edit to the JSON.
- **Module availability** (`@core/auth/access-rules.ts`, `resourceAvailableFor`): which permission groups an account is offered used to be a hard-coded switch in `AuthService`; it now reads the registry's `availability` tags. Same results for every resource, now covered by tests.
- **Page rules** (`pageRuleDecides`): the pages open by rule and not by a role's paths (notifications, the app guide, help, the knowledge check, the financial dashboard, the pharmacy guide) are a table instead of a run of `if`s in `isUrlAuthorized`.
- **Menu:** each entry declares the permissions it opens for (`needs`, data) instead of a hidden closure; the four entries with their own rule (Dashboard, the two guides, Knowledge check) have none. Tests check every declared permission against the registry.
- **Two rows the API already honoured but the editor could not grant:** `gst` (read, import, reconcile, lock: GST reconciliation) and the older `stock` actions `adjust` and `audit`. The API's module gating now lists `gst` too (switching GST off hides those grants, as for the other modules).
- **The cross-check** (`api-v2/src/core/permission-registry.spec.ts`; it reads the frontend files, so it runs from a full checkout and is skipped where only api-v2 exists): the registry is well formed; it has every permission the API checks by name (`@Permission`, `can`, `hasPermission`, `grants`, the GST actions); it has every permission the screens ask for (`*isAuth`, `has(...)` in templates, `isActionAuthorized`); and it agrees with the API's module gating for every resource (`filterPermissions` run once per module switched off). I broke the registry on purpose (removed a row, mis-tagged another) and three of the five tests failed, then restored it.

Checked: frontend unit suite 100 of 100, development build compiles (`resolveJsonModule` and `allowSyntheticDefaultImports` added to the frontend tsconfig), API suite 1,254 pass.

**What this does and does not do:** the API still enforces in code (`@Permission`, `PermissionService`, the role-name checks of section 8); it does not read the registry at run time, the test keeps the two in step. From here, steps D and E start with a row in the registry; the test then fails until the API check, the menu entry and the migration for existing roles exist.

Not done in step C: classing each permission by who may delegate it (section 4, point 5): the existing `overreach` rule (a manager can only hand out what they hold) still applies to every key, and the owner-only keys will be declared when step D and E add them (force void, compliance waiver, pay, edit a completed invoice). Scope on the grant (own, store, business) is also left for step E.

---

## 12. Tested in Docker (2026-11-16)

A fresh QA database (`rgp_qa`, in the `rgp-db-dev` Postgres; the other databases there were not touched) was built from the DDL plus every migration 008 to 208, seeded through the API, and the whole Playwright suite (883 tests) was run against the current code. `qa/scripts/bootstrap-db.sh` stopped its migration list at 122; it now adds every later migration from the directory (rollbacks left out), so a fresh QA database is complete.

- **Migration 208 on real Postgres 17:** applied cleanly in the bootstrap; Business Head, Owner-operator and Store Head got `customerorders` view and manage and `deliverypartners` manage; Sales Staff and Counter got `customerorders` view only; Personal and Site Admin got neither.
- **Whole suite with my changes:** 669 passed, 139 failed, 73 skipped or not run. **The same suite on a build of HEAD** (before any of my changes, own database, ports 3300/8300): 667 passed, 146 failed. Compared test by test: **135 fail in both**, so they are not caused by my changes (mostly specs older than newer rules: a customer, staff or vendor name with a digit or a one-letter name is refused with 400 since 13 Nov; invoice confirmation needs a net total; module defaults and menu lists that grew; a few UI timeouts). 11 fail only at HEAD (my new report specs, REFILL-4 which I fixed, and a few that depend on the random seed). **4 fail only with my changes** and none comes from my code: three bills are refused with "The GST rate has changed for 1 item: Aceclofenac 20mg Sachet [MAN1064] (5% on the bill, 12% today)" and SUG-1 needs seeded sales; the generator has no fixed seed, so two seedings choose different products (the baseline database has no such product at all), and the four fail again on a second run of my stack for that reason.
- **Found and fixed while testing:** the old menu's Customer orders link still used `sales` (now `customerorders.view`); the guide had no Calendar page (the menu has had the entry since migration 174), which failed APPG-1; my RPT-6 used a fixed Aug to Sep date window the seed does not cover (RPT-1 had the same stale window; both now use the last 60 days); RB-4, RB-5 and REFILL-4 used names the 13 Nov name rule refuses (now valid names).
- **Checked and passing with my changes:** the Reports specs (RPT-5, a role without the Reports page gets 403, and RPT-6, bad dates are a 400 and an injection-shaped filter matches nothing), MG-2 (the grouped menu with no Staff and quality), the app guide pages for the menu entries I added, delivery partners, grievances, audit, discrepancies, staff credit and staff sales, role builder, dashboard setup.

Still red at HEAD and unchanged: APPG-1 (the guide now lacks a WhatsApp page, the next missing entry), MG-1b (the fresh database's Sales Staff has no attendance permission, so the counter has no People section), PACC-3 and PACC-6 (the old menu's Sell list and the desktop sidebar toggle have moved on), OM-14, OM-19, OM-20, XCUT-2, EXP-2 (the 400-before-403 name rule and module defaults), and about 100 others listed by the failing-spec files; none is in the menu, registry or permission code this work changed. There is no QA spec yet for Customer orders (the new `customerorders` permission is covered by unit tests and the migration check only).

---

## 13. Review findings checked and fixed (2026-11-16, uncommitted)

A code review of the uncommitted work raised six points; each was checked against the code.

- **Owner roles and the two new permissions (delivery partners, customer orders).** Real. The API let the owner roles through Customer orders by name, but not Delivery partners (so a Business Head role made later by provisioning, a seed or a config import would get a 403), and the app was told only what the stored role carried (so the menu entry and the page were closed to such an owner). Fixed in both places: `PermissionService.canManageDeliveryPartners` (owner roles by name, else the grant; named permission `manageDeliveryPartners`), and `core/owner-floor.ts` (`withOwnerFloor`), which adds the missing `customerorders` (view, manage) and `deliverypartners` (manage) blocks to what the app is told for an owner role, next to the existing `kpirate` rater rule in `user.service.ts`. The stored role is never changed. Checked live: with the Business Head role stripped of both blocks, the app is still told the owner has both, the owner lists customer orders (200) and adds a partner (201), and Sales Staff are still refused (403).
- **The old menu's Customer orders link** needed `view` while the grouped menu accepts `view` or `manage`. Real. The old menu now accepts either.
- **The customer orders guard covers the whole controller** except the one endpoint purchasing uses. By design (a new endpoint is closed until someone decides it is open). The till swallows the 403 from `/commitments/ready`, so a role that can bill but has no customer-orders permission simply sees no orders to collect.
- **"Business Head and Store Head now see Purchase requests next to Purchase."** Not so for that half: neither holds `purchases.request` (only Counter and Sales Staff do), so they still do not see it. The Refills half is the intended change (Refills sits in Sell, next to Complaints, in both menus).
- **The sale report had no cap on rows.** Real. A search or export now returns at most 50,000 bill lines; more is a 400 asking for fewer days or a category. The date range is not capped on purpose (QA RPT-4 asserts a two-year range works).
- **`bootstrap-db.sh` applies every 3-digit migration from 123 in name order**, including 182. Intended for a fresh QA database (all 86 applied cleanly in the Docker bootstrap); it does not touch any other database, and a prefix that is not three digits is not matched.

Checked: API suite 1,260 pass; focused QA run on the rebuilt stack 50 pass; the 2 failures are the known counter-menu check (MG-1b, fails at HEAD too) and DLVP-1, whose partner creation and listing pass and whose next step needs a verified stock row with a balance over 20 that the full run left too thin.

## 14. Step D, Reports built (2026-11-16, migration 209, committed)

The `reports` permission was a bare presence; Ask the shop and the weekly summary were decided by role name. It now carries six actions: `sales` (the sales report and Ask the shop's sales, payment, expense and top-product reports), `purchases`, `stock`, `margin` (profit, thin-margin, customer dues, the weekly summary), `ask` (the Ask the shop tab) and `export`. The owner roles hold all of them by name; migration 209 keeps every existing Reports role's access (sales, purchases, stock, export), gives the Store Head `ask`, and gives the owner roles `ask` and `margin`. Rules in `insights/report-access.ts`; QA RPA-1..6.

## 15. Step D, HR built (2026-11-16, migration 210, uncommitted)

The HR API let in only the role named Business Head and ignored the `hr` view and manage boxes. Now each of the 82 routes of `HrController` needs an action, matched by method and route in `hr/hr-access.ts` (a unit test fails if any route has no rule; an unnamed route is for the owner roles only):

| Action | Routes |
|---|---|
| `staff.view` / `staff.manage` | staff records, positions, starter set, hiring, leaving, rejoining, linking a login |
| `pay.view` / `pay.manage` | salary revisions, pay components, bank details; the staff list and record leave out earnings and revisions without `pay.view` |
| `payroll.view` / `payroll.run` / `payroll.approve` | runs, stubs and export; generating and editing a run; approving and reopening it |
| `attendance.manage` | the attendance grid and marking |
| `leave.manage` | leave types, balances, requests, decisions, holidays |
| `kpi.setup` | KPI measures, bands, scoring, finalising, the role assistant |
| `bonus.manage` | bonuses |

`hr.view` stays and opens the HR pages; each tab needs its own action (`hr-access.guard.ts`, which also sends a closed tab to the first open one). `hr.manage` was kept only because the customer credit and dues screens read it as a UI flag; step E (section 20) moved them to `customers.credit.correct` and dropped `manage` from the role editor. Decisions: migration 210 gives the actions to the owner roles only (a custom role with `hr` ticked never had API access, so nothing is granted for it); the Owner-operator now holds HR like the Business Head. `owner-floor.ts` fills in missing HR actions for an owner role that already holds the HR page and never adds the page (HR follows the module switch). QA RHA-1..6 (the older HR specs fail on a database where `sales2` already has a staff record with history; they need a fresh seed).

Not in this pass: the other HR controllers (My HR, leave approvals, KPI rating, punch and attendance review) still decide by role name, and Coaching still follows the insights rule.

## 16. Step D, Purchasing: the sensitive actions (2026-11-16, migration 211, uncommitted)

Purchasing was already guarded by `PurchasingGuard` (read, add, edit, delete, request, vendors.edit; order approval by `purchaseorders:approve`). What could not be separated: payments, vendor returns, and four owner-by-name actions. Seven actions are added on the `purchases` permission (rules in `purchases/purchasing-access.ts`; the owner roles and the platform admin hold all by name):

| Action | What it covers |
|---|---|
| `payments.view` | the payments made on an invoice (`PurchasingReadAction`, new in the guard) |
| `payments.record` | record a payment, a pay run, change a payment |
| `payments.reverse` | reverse a payment |
| `returns.manage` | record or cancel a vendor return, take a credit on or off an invoice |
| `invoices.editcompleted` | change or delete an invoice that is already complete |
| `invoices.approvepay` | approve an invoice for payment, withdraw an approval, change the approval rule |
| `invoices.recalculate` | check and correct invoice totals and line totals |

Decisions: this pass covers the sensitive actions only; read, add and edit stay as they were, so the Purchase page and its tabs are untouched. Migration 211 keeps access for everyone who has it today (`payments.view` for roles with read, `payments.record` for add or edit, `returns.manage` for add or delete) except `payments.reverse`, which goes to the owner roles and the Store Head only (it was any role with add). The three invoice actions go to the owner roles. Putting an invoice on hold and releasing it were never owner-only and stay under add. The invoice list hides Pay, change payment and Reverse without the action. QA RPU-1..5.

Not in this pass: splitting Orders, Invoices, Payables and Vendors into view, add and edit actions, and Purchasing as separate menu entries (the full split in section 5).

## 17. Step D, Stock: the auditStock gate split (2026-11-16, migration 212, uncommitted)

One gate, `auditStock`, opened quantity adjustments, audits (approve, recount, reject), counts and store-to-store transfers together: the Business Head, Owner-operator and Store Head by name, or any role with store adjust, stock adjust or stock audit. It is split into five actions on the `store` permission (rules in `stock/stock-access.ts`, read by the guard as `@Permission('stockDo:<action>')`):

| Action | Routes |
|---|---|
| `qty.adjust` | `/stock/adjust/*` (list, change, bulk, returns, delete) and raising an audit (`POST /stock/audit`) |
| `audit.approve` | the pending audits list, approve, recount, reject |
| `count.perform` | start, list, open items, detail and submit a stock count |
| `transfer.request` | list and availability of transfers, dispatch, cancel |
| `transfer.receive` | receive a transfer (so a different person receives, as the transfer rules intend) |

Decisions: only the `auditStock` gate was split; disposal (out-passes, write-offs), the vault and cash still decide by role name in their services. The owner roles hold the actions by name; the Store Head holds them by migration 212, not by name, so a Store Head role can be narrowed in the editor. Migration 212 gives all five to the same roles the gate let in (the three named roles, any role with store adjust, any role with stock adjust or audit; a role with no `store` block gets one with an empty path that opens no page). After this a role built with only `store.adjust` no longer changes stock; `store.adjust` now means managing shifts. QA RST-1..5.

## 18. Step E, Accounts: Finance and GST filing (2026-11-16, migration 213, uncommitted)

Finance and GST filing were each one presence check that opened everything. They now carry actions (rules in `finance/accounts-access.ts`; `view` stays what it was, holding the resource opens the pages; the owner roles hold every action by name):

| Resource | Action | Covers |
|---|---|---|
| `finance` | `bank.import` | bank accounts (add, change, delete), statement preview and import |
| `finance` | `reconcile` | tag a line, remove a rule, sign a month off, reopen it |
| `finance` | `records` | the records check and attesting it |
| `gstfiling` | `prepare` | rate changes (preview, create, cancel), HSN codes, supply kinds, the GST registration |
| `gstfiling` | `export` | the sales register, report and filing pack as files |
| `gstfiling` | `lock` | close a GST month |
| `gstfiling` | `unlock` | reopen a closed GST month |

Decisions: this area first; scope on the grant is a later step of its own. Migration 213 keeps every role's access (every role holding `finance` gets bank.import, reconcile and records; every role holding `gstfiling` gets prepare, export and lock) except `unlock`, which goes to the owner roles only. GST reconciliation (`gst`: read, import, reconcile, lock, which also covers unlocking a reconciliation period, and the Store Head holds it by name) and Digital payments (`paymentrecon`) already had enforced actions and are unchanged; splitting `gst` unlock from lock is left for later. The Finance and GST pages do not yet hide buttons a role lacks the action for (the API refuses). QA RAC-1..4.

## 19. Step E, Setup (2026-11-16, migration 214, uncommitted)

Four Setup actions were the owner roles by name only. Three sit on the Business Details permission (`businessprofile`), which already carries the pages they live on (shop setup, import and export), one on `users` (rules in `business/setup-access.ts`; the owner roles hold each by name):

| Permission | Action | Covers |
|---|---|---|
| `businessprofile` | `modules.manage` | read and switch modules, read, preview and apply a setup preset |
| `businessprofile` | `transfer.export` | export the business setup (JSON, Excel) and the blank template |
| `businessprofile` | `transfer.import` | read an Excel setup, preview and apply an import |
| `users` | `mfareset` | unlink someone's authenticator, on top of being allowed to manage that person |

Decisions: no new pages (the actions ride on the existing Business Details page); the business details themselves (`businessprofile.manage`) are still the owner roles by name in the API, which this pass does not change. The Business Details box is no longer a one-tick bundle, so the actions can be chosen. Migration 214 gives the three businessprofile actions to the owner roles only (they were owner-only), and `mfareset` to every role holding `users` edit (a Store Head could reset the authenticator of their own staff before). There is no admin password reset in the app, so there is no `users.resetpassword`. The Site Admin still resets authenticators by name. QA RSU-1..4.

## 20. Step E, Customers (2026-11-16, migration 215, uncommitted)

Seven customer actions were decided by role name in five services. They are now actions on the `customers` permission (rules in `customers/customers-access.ts`; the owner roles hold every one by name):

| Action | Covers | Was |
|---|---|---|
| `delete` | delete or archive a customer | a manager (the box already existed and the list showed the icon from it) |
| `merge` | merge two customers, or two households | the Business Head |
| `creditlimit.set` | set a customer's credit limit | a manager |
| `credit.correct` | correct what a customer owes, or store credit, with a reason | the Business Head |
| `households.manage` | change a household number, give someone their own account, move people | a manager |
| `followup.wording` | change the follow-up message wording | a manager |
| `relationships.setup` | the active-customer and contact-cap settings | the Business Head |

Seeing full contact details (`reveal`) and downloading lists (`export`) already had grants and are unchanged. Decisions: the owner roles by name, the Store Head by migration 215 (the three manager-level actions, so a Store Head role can be narrowed in the editor), the owner-level ones to the owner roles only. A custom role that already had the `delete` box ticked now really can delete (the API used to refuse everyone but the managers). The credit and dues screens read `customers.credit.correct` instead of `hr.manage`, which is gone from the role editor. QA RCA-1..4. The day-to-day surface is section 24.

## 21. Step E, Sales: the till overrides (2026-11-16, migration 216, uncommitted)

Void and force void already were permission-driven (`sales.void`, `sales.forcevoid`). Four more things the till decided by role name are now actions on the `sales` permission (rules in `sales/sales-access.ts`; the owner roles hold each by name):

| Action | Covers | Was |
|---|---|---|
| `batchstop.override` | sell through a batch stop (expired or blocked batch), written to the audit log | a manager |
| `creditlimit.override` | bill a customer on credit past their limit or while dues are overdue | a manager |
| `deliveries.manage` | change the delivery of someone else's bill or one whose shift is closed, and pay a delivery charge from another open shift | a manager |
| `returns.settings` | set what a category does on return | the owner roles |

Decisions: only what was already decided by role name was converted, so the till behaves the same on day one. Migration 216 gives the first three to the owner roles and the Store Head (by grant, not by name) and `returns.settings` to the owner roles. NOT done, because they have no enforcement today and adding keys would need every sales role to hold them first: `discount`, `pricing.override`, `creditsale`, `reprint`, `edit` (completed bill), `returns.view/add/approve`, `deliveries.view`, `export`, and (with Customers) adding and editing a customer, `dues.collect`, `worklist.use`, `consent.view`. A person's own-bills-only view is a data scope (shift mode), not a permission. The QA suite checks `returns.settings` through the API and the migration; the other three change what a bill is allowed to do and are covered by the unit tests, not by a till flow in QA. QA RSA-1..3.

## 22. Scope on the grant (2026-11-16, no migration, uncommitted)

A policy may now carry a `scope` that says how much of a screen it reaches. Two scopes: `store` (the stores the person works at, and what they raised or were given) and `business` (every store). A policy with no scope behaves exactly as the screen always did, so no existing role changed and no migration is needed. A scope only widens: it never narrows a person below what the screen already gave. The owner roles are the business whatever is stored. Rules in `core/scope-grant.ts`; `scopeOf(manager, user, resource, action, legacy)` is what a service calls, passing what a role of that name saw before scope existed.

| Screen | Action | Legacy (no scope written) | Where it applies |
|---|---|---|---|
| Expenses | `view` | owner roles the business, Store Head their stores, staff what they raised | the ledger list and the report |
| Vendor issues | `view` | owner roles everything, everyone else their stores and what they raised | the list and one issue's visibility (managing and closing stay the owner's) |
| Inquiries | `view` | owner roles everything, Store Head their stores, staff what they raised or were given | the list, the summary and one inquiry's visibility |
| Digital payments | `view` | owner roles every bill and the statement, everyone else their stores | the bill list, the statement view and the bill checks |

Decisions: store and business only (no `own` yet: it needs a per-screen meaning); the four screens whose role-editor labels already named scope; only the view of a screen is scoped, never who may approve, edit, import or close. Delegation: `overreach` refuses a scope wider than the giver holds (a manager holds `store` unless their own grant says `business`) and any value that is not a scope. The role editor shows a "Reaches" choice under the view action of these four screens (`scoped: true` in the registry) and saves it on the grant. Not done: the own-bills-only sales view and the store scope of the sale report (they read the store by shift mode and the user's stores, not by grant), and the other screens that name scope in their labels (they do not read a grant yet). QA RSG-1..5.

## 23. Menu rollout (2026-11-16, uncommitted)

The grouped menu is now the default. `views.new_menu` (`api-v2/src/core/config/config-schema.ts`) defaults to **on**; the app shell starts with it on and reads the saved value (it used to start off and flash the old menu). A business that saved the choice off keeps the old menu, and the old hard-coded menu stays in `secured.component.html` for one release as the way back. The counter roles already had the grouped menu whatever the switch said.

Decisions: flip the default, keep the switch and the old menu (do not delete it yet). To put one business back on the old menu: Settings > Dashboards and compliance > Views, or `PUT /config/views { values: { new_menu: false } }`. To remove the old menu later: delete the `*ngIf="!groupedMenu"` branch and the `newMenu` switch once no business has saved it off, and the `MenuModeService` tab-strip fallback in the Quality pages.

Checked: the 29 QA specs that touch the menu (`nav-` ids, the sidebar) give the same result before and after the flip: 160 passed and the same 36 failing, none of them new. Five specs assumed the old menu and were updated (`audit`, `grievances`, `staff-sales`, `refills` and `discrepancies`: they looked for the old "Staff and quality" entry or a heading that now shows twice, the page's own heading under the shell's); MG-1 now asserts the default is on, MG-1b switches it off to check the counter roles still get the grouped menu while the Business Head keeps the old one, and MG-2 checks the default groups. Known cosmetic: in the grouped menu the Quality pages show their title twice (the shell heading and the page card title). Still red before and after, unrelated to the menu: APPG-1, PACC-3, PACC-6, OM-14/19/20/24/25/27, XCUT-2, XCUT-4, EXP-4 and about 25 others, mostly data state of the QA database and rules newer than their specs.

## 24. Step E, Customers: the day-to-day surface (2026-11-16, migration 217, uncommitted)

The first Customers pass (section 20) covered the sensitive actions and left the everyday routes open to any signed-in login: who owes (`customer-dues`), taking a payment, the worklist, snooze, the contact log, consent, review invites, a customer's care and profile, the audiences. These now name an action on the `customers` permission (guard `customer-action.guard.ts`, `@NeedsCustomers('<action>')` on each route; a test fails if any route of the two controllers has none):

| Action | Covers |
|---|---|
| `dues.view` | who owes (`owing/all`), a customer's dues and their brief |
| `dues.collect` | take a payment against a customer's dues |
| `audiences.use` | the audiences and an audience's members. On its own it opens the screen with the numbers **masked** (the person shows one at a time, counted and capped per day, as on the contact list); `reveal` shows them all. The audience download still needs both `reveal` and `export` |
| `worklist.use` | the daily contact list, summary and settings reads, follow-up wording read, snooze and unsnooze, the contact log (read and write), review invites, a customer's care and profile |
| `consent.manage` | record a customer's consent |

The two routes that already had a service-level check now also name theirs (`creditlimit.set` on the limit, `credit.correct` on the adjustment). Decisions: every role that already holds the Customers page gets all five (migration 217), so nobody who uses the page loses anything; a role **without** the page no longer reaches them. The till's credit check (`:id/brief`) also lets through any role that can add or bill a sale, so billing on credit keeps working for a role with no Customers page. Owner roles hold all five by name. Not split further (read versus write per area), and adding and editing a customer is still open because the till creates customers.

**Found on the way, fixed:** `GET /customer-dues/owing/all` (the "who owes" list) returned a 500 for everyone, the owner included: its query ordered by `c.name`, which is not in the `group by`, and Postgres refuses that. Now `order by min(c.name)`. QA RCD-1..4.

**Correction (same day):** the first version of this pass still required the old `reveal` grant to open the audiences, so a role given `audiences.use` alone saw nothing (the Customers page link also waited for `reveal`). Now `audiences.use` is enough: the link follows it, the API lists the members with numbers masked unless the role may read them all, and the screen offers Show number instead of the WhatsApp and Call links until a number is shown. QA RCD-2 and RCD-5 cover it.
