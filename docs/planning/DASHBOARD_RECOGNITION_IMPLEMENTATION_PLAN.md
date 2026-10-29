# Implementation plan: role dashboards, compliance register, recognition, per-business configuration

Status: **plan, nothing built beyond D0** (2026-10-25). Inputs: `DASHBOARD_AND_MENU_DESIGN.md`, `RECOGNITION_AND_COMPLIANCE.md` (decisions in its sections 9 and 10), and the clickable mock (Owner, Manager, Staff, Counter, Personal, Setup).

## 1. Principles for the build

1. **Config first, then features.** Every feature reads its settings through one resolver (pack default, business, optional store, clamped to a floor). Nothing hard-codes a threshold that the design makes configurable.
2. **Reuse, don't parallel.** Reminders and escalation go through the alerts engine and notification channels; waivers follow the approvals pattern; blocks sit in the existing sale `check` hook and shift open/close; checklists stay in `shift-checklist.ts`.
3. **Help before force.** Ship the register in "report only" mode, then reminders, then "do this to continue", then blocks, each switchable per item. A new block starts as "required" and is watched before it blocks.
4. **Each stage is shippable.** Migration with rollback, API, screen, QA specs, unit tests for the pure rules, memory note. Same practice as earlier work (`qa/` Playwright suite, relative imports in pure rule files, `ng build` check before docker).
5. **Authority from the server.** Role scoping, floors, waiver rights and "own items only" are enforced in the API, never by the screen. D0 already scopes dashboard data by business and store.

## 2. Stages

Sizes: S under 2 days, M 3 to 5, L 6 to 10 (one person, including QA).

### Stage 0: Prerequisite checks (S)
- Confirm each bill records **who served** (named operator) when a till login is shared. If not, add it (nullable `served_by` on the sale, picker on the bill screen, required when the user's role is Counter). Recognition on the Counter view depends on this.
- Confirm shift records the person for every close and checklist tick.
- Grant Counter and Personal roles their dashboard path (today Sales Staff has no `/secure/dashboard` permission).
- Fix the design doc's menu tree (8 groups).
- **Exit:** a short findings note; no feature work.

### Stage 1: Configuration foundation (M) — migration 110
- Tables: `config_override` (business_id, store_id null, scope, key, value jsonb, effective_from, created_by) with unique (business, store, scope, key, effective_from); `config_audit` reuse the existing audit service if it fits.
- `EffectiveConfigService`: resolves pack default, then business, then store; clamps to a **floor** declared with each default (`legal`, `min_enforcement`, `removable:false`); picks the row with the latest `effective_from` not after today; brief cache cleared on save.
- Pack defaults live beside the existing pack config (`packs/pack-config*.ts`, `pharmacy-config.ts`); the base set for a general business.
- Endpoints: `GET /config/effective?scope=`, `PUT /config/:scope` (Business Head only, validates against floors, writes audit), `DELETE` to reset a key.
- Frontend: a thin `ConfigService`; no screen yet.
- **Tests:** unit (layer order, floors, effective_from, clamping), QA (only Business Head saves; a floor cannot be weakened; a future date is not applied early).
- **Risk:** over-generic design. Keep keys typed per scope (`compliance`, `recognition`, `health`, `views`, `words`) with a schema each.

### Stage 2: Compliance register, report-only plus reminders (L) — migration 111 (R1)
- Tables: `compliance_item` (definition: key, class, owner role, pack, due rule, ladder defaults, legal flag), `compliance_instance` (item, store, person null, due_at, state, step, closed_at, closed_by), `compliance_event` (instance, kind: created/step/closed/disputed/waiver_requested/waiver_granted/reason, actor, note), `compliance_waiver` (instance, requested_by, granted_by, reason, until).
- **Generators** (a scheduled job and event hooks) for what already exists: stock count due, outage kit weekly check, shift close and checklist, deposit due, weekly review sign-off, licence and registration expiry, GST month close (when registered), pending deliveries, refill calls, parked bills, HR documents (Personal view). Each generator is a small pure function from facts to instances, so it is unit tested.
- **Ladder engine:** moves an instance through Reminder, Due, Late, Required, Escalated using the effective config; writes an event each step; raises alerts (new alert kinds) to the right person: store head at the late step, Business Head at the escalation step. Reuses alert dedup so nothing repeats within a day.
- **Attribution:** by duty and shift (owner person where personal). "Not mine" pauses an instance and tells the store head.
- API: `GET /compliance/mine`, `GET /compliance/store/:id`, `POST /compliance/:id/not-mine`, `POST /compliance/:id/waiver-request`, `POST /compliance/:id/waiver` (Business Head only), `GET /compliance/summary` for the dashboards and health.
- Frontend: an "Items to finish" list component reused by Staff, Personal, Counter and Manager views; the Inbox shows items; Manager register table.
- **Tests:** unit for each generator and for ladder timing; QA for the lifecycle, waiver rights (store head cannot grant), "not mine", scoping by store.
- **Exit:** items appear, climb, and escalate with no blocking yet.

### Stage 3: Dashboard shell and role views (L) — migration 112 (D1 + D5)
- `dashboard_view` column on role (`owner`, `manager`, `staff`, `counter`, `personal`, `platform`), seeded from role names and editable in config (not a permission list). Business-level override through Stage 1 config.
- Backend: `GET /dashboard/view` returns the view key and the widgets allowed for it; each widget endpoint stays scoped by D0 and gains role gates (cost and margin owner only; staff comparison owner and manager; counter and staff see own or shared figures only; customer names never).
- Frontend: one dashboard page that renders the view by key from reusable blocks (Needs-you-now strip, celebration slot, goals, numbers, badges slot, notes, register). The eight-group menu (Home, Sell, Inventory, Purchasing, Accounts, People, Oversight, Setup) driven by permission, with badges from counts and Ctrl+K search. Keep the old routes working.
- Owner and Manager views first; Staff, Counter, Personal follow in the same stage using the shared blocks.
- **Tests:** QA per role (what each sees and cannot see), menu by role, route redirects; Angular `ng build` check.
- **Risk:** menu regroup disturbs users. Ship behind a business config flag (`views.newMenu`), default on for new businesses, off for the live one until trained.

### Stage 4: Recognition engine (M to L) — migration 113 (R3)
- Tables: `recognition_rule` (key, measure, defaults), `recognition_award` (rule, person, period, evidence jsonb, awarded_at, lapsed_at, seen_at), `recognition_note` (from, to, text).
- Evaluators (pure, tested): accurate till, customer capture, refill calls, on-time handover, rush hour, beat your usual, compliance clean, initiative. Habit rules only; the save endpoint rejects rules on raw sales or discount depth. A discount or returns spike pauses "beat your usual".
- Nightly job awards and lapses; a **streak pause** rule reads the register (an overdue own item pauses new awards and shows "paused").
- Delivery: celebration (first view after award), Inbox card, thanks suggestion to the store head, one-line notes. Named operator used for shared logins; the Counter view shows shared store goals only.
- Visibility: heads see everyone's badges in name order; staff see their own; no ranking endpoint exists.
- **Tests:** unit per evaluator with fixtures, QA for award, lapse, pause, visibility, no-leaderboard.

### Stage 5: "Do this to continue" and waivers (M) (R2)
- At shift open, shift close and login, the server returns outstanding Required items; the screen shows the dialog with action or reason; reason is stored and shown to the store head. Close is the one hard block for a shift (cash count), per decision 1.
- Block hooks for legal items not yet covered, each introduced as Required first, behind an item flag.
- Waiver granted by the Business Head only, with reason, expiry, maximum length from config; an expired waiver returns the item to its step.
- **Tests:** QA of the dialog, reason capture, waiver expiry, and that a non-legal item never blocks the till.

### Stage 6: Charts, health, targets (L) (D2 to D4)
- Metric endpoints in one pass: sales by month against the same months of the last two years, margin (owner), categories, customers new and returning, deliveries, cost and margin, finance snapshot, stock health, payables ageing, busy hours. Read from the existing tables with tested SQL and index checks on the 61k-bill copy.
- `metric_target` (store, month, value), health score service reading the register and the weights from config, with the "check under 60 holds at Watch" safeguard.
- Charts with ngx-charts (already used), interactive per the mock; drill links to the lists.
- **Tests:** query specs with seeded data, speed check on `rgp_prodview`.

### Stage 7: Setup screen (M) (C1)
- Business Head screen "Dashboards and compliance": tabs Views, Goals and badges, Compliance, Health and targets, Wording; default beside choice, Reset, locks, save-from date, Preview as a role, audit list. Manager gets read-only rules.
- Plan limits through the SaaS entitlements (which keys a plan may change).
- **Tests:** QA for floors, effective date, reset, preview, audit.

## 2A. Stage 0 result and decisions (2026-10-25)

Decisions taken: **business-level configuration only** (store override for targets), **a plan may limit any setting**, **the Manager changes nothing**, **longest waiver 7 days**, **Counter shared logins stay**. The views follow one standard layout (design doc 6A).

Findings:
- **Named operator exists**: `sale.acting_user_id` is set per bill (the "who is serving" picker; Counter and Site Admin logins are not listed as people) and `store_shifts` records `opened_by` and `closed_by`. No change needed; recognition reads `coalesce(acting_user_id, created_by)`, as the HR KPI and quality code already do.
- **Dashboard path**: only Business Head, Store Head, Owner-operator and Site Admin have `/secure/dashboard`. Migration 109 (written, with rollback) adds it for Sales Staff, Counter and Personal. It is **held back and applied with stage 3**, because today it would show them the owner layout.
- **Menu**: the design doc's tree now has the eighth group, Oversight (Compliance, Weekly review, Staff and quality, Approvals, Audit log).
- **Standardisation**: the design doc gains section 6A (page anatomy, component rules, shared behaviour, widget-registry build). The mock boards are aligned to it in stage 3's first step.
- Migration numbers shifted by one: 109 dashboard path, 110 config, 111 register, 112 shell, 113 recognition.

## 2B. Stage 1 built (2026-10-25)

- Migration `110_config_override.sql` (+ rollback): one row per business, scope, key and start date. Applied to `rgpdb` and `rgp_prodview`; added to `qa/scripts/bootstrap-db.sh` (109 stays out until stage 3).
- `api-v2/src/core/config/config-schema.ts` (pure, tested): the typed key list for five scopes (compliance, recognition, health, views, words), defaults by business type, pack-only keys, floors (min, max, step, options, locked), `resolveConfig` (latest row that has begun; a stored value that fails its floor is ignored), `checkValue`, `checkScope` (health weights add up to 100, Watch safeguard below Healthy).
- `config.service.ts`: `GET /config?scope=`, `PUT /config/:scope` (Business Head only, from a date between today and 90 days ahead, tomorrow by default, all-or-nothing, audited with before and after), `DELETE /config/:scope[/:key]` (reset). `ConfigService.valuesFor(businessId, scope)` for server rules. Plans can lock a scope or a key through the new optional `configLocked` in the entitlements (the control plane does not send it yet).
- Frontend `shared/config.service.ts` (typed, no screen).
- Tests: 13 unit (`config-schema.spec.ts`), QA `config.spec.ts` CFG-1..5 pass.
- Not done on purpose: cache (reads are one small query), the control plane field, per-store targets (own table later), the Setup screen (stage 7).

## 2C. Stage 3a built: the shell (2026-10-25)

Done:
- `GET /dashboard/view` returns the view of the caller's role, its widget list in the standard order, and the business's `views` settings (stage 1). Pure resolver `dashboard/dashboard-view.ts` (+5 unit tests): Business Head and Owner-operator get `owner`, Store Head `manager`, Sales Staff `staff`, Counter `counter`, Personal `personal`, Site Admin `platform`; a custom role gets `manager`, never `owner`; owner-only widgets are in no other list.
- Shared components `app-dash-header` (title, scope bar, updated time) and `app-needs-strip` (chips by tone, each opening its screen, kind empty state), registered in `SharedModule`.
- The current dashboard page now opens with the standard header and a Needs-you-now strip (purchase approvals, deposit due, overdue invoices, low stock), asks the server for its view, and keeps every existing card and test id. `ng build` (AOT) passes; QA DV-1..2 pass with the dashboard-scope and config specs.

Not yet (stage 3b onward):
- Regrouped eight-group menu with badges and Ctrl+K search (behind `views.new_menu`).
- The Staff, Counter and Personal views and their widgets (my day, goals, badges, notes, shift, attendance, leave); **migration 109 stays held** until they exist.
- Owner and Manager restructured into the hero, tiles and cards order, and the mock boards aligned to 6A.
- A browser pass on the rebuilt stack.

## 2D. Stage 3b built: menu and role views (2026-10-25)

- **Grouped menu** (`secured/menu.ts`, rendered in `secured.component.html`): the eight groups (Home, Sell, Inventory, Purchasing, Accounts, People, Oversight, Setup) as data, each entry gated by the same permission checks and keeping its test id. It is **off by default** and turned on per business through the `views.new_menu` setting; with it off the long-standing menu is untouched (the purchasing-access spec still holds).
- **Staff and Counter views** (`GET /dashboard/mine`, `dashboard-mine.ts` with 5 unit tests, `StaffViewComponent`): the person's day against their own usual (same weekday over eight weeks), the ring toward usual plus 10%, hourly bars, last 7 days against the usual week, three goals (mobile number, parked bills, deliveries), parked bills, and the store's shared day. A person's own login counts the bills they served (`acting_user_id`); the shared counter login counts bills made on that login. No cost, no customer names, no other person's figures (QA DM-2).
- **Personal view** (`PersonalViewComponent`): the person's own HR summary (leave, pay, next holiday) from the existing `/my-hr/summary`.
- **Migration 109 applied** (rgpdb, rgp_prodview) and added to the bootstrap list: Sales Staff, Counter and Personal can open `/secure/dashboard`.
- Owner, Manager and Platform keep the long-standing cards under the standard header and Needs-you-now strip.
- Tests: QA DM-1..3, DV-1..2, DS-1..5 pass; AOT build clean.

Not done in stage 3 (deliberately): reordering the owner and manager cards into hero, tiles and cards, and re-cutting the mock boards to the 6A anatomy. Those wait for the charts stage (6), when the owner and manager pages are rebuilt on the shared widgets. Badges and notes widgets arrive with recognition (4), and compliance items with the register (2).

## 2E. Stage 2 built: the compliance register (2026-10-25)

- Migration `111_compliance_register.sql` (+ rollback; applied to rgpdb and rgp_prodview; in the bootstrap list): `compliance_instance` (unique per business, item, store, person and period), `compliance_event`, `compliance_waiver`, and the `compliance` permission (path `/secure/compliance`) for Business Head, Owner-operator and Store Head.
- `modules/app/compliance/compliance-rules.ts` (pure, 12 unit tests): the item list with class, owner and ladder defaults; `stepOf` (reminder, due, late, escalated, waived, done), `ladderFor` (reads the business's days from stage 1 settings), `waiverEnd` (held to the longest waiver).
- `compliance.service.ts`: generators from facts that already exist, set-based (a sync is about ten statements, ~0.6 s):
  stock count (every 14 days), outage kit check (every 7), weekly review (last full week), licence renewal (legal, 30-day reminder, late on the day it ends), shift not closed after its day (cash, owned by the accountable person), parked bill over a day old (owned by whoever served). A sync opens what is owed, closes what is no longer owed (done), and moves steps; every change leaves an event. Runs every 10 minutes and on read when older than 2 minutes; the Business Head can refresh now.
- API: `GET /compliance/mine`, `/store` (managers only), `/summary` (counts and what the caller may do), `/:id/events`; `POST /:id/not-mine`, `/:id/waiver-request` (store head or Business Head, reason required, one pending), `/:id/waiver` (Business Head only: grant for a number of days up to `waiver_max_days`, or `grant:false` to decline). Everything audited.
- Frontend: Oversight > Compliance screen (filters by step, history, ask, grant, decline, not mine), the item list on the Staff view ("To finish" with "Not mine"), a compliance chip on the Owner and Manager strip, menu entry in both menus.
- Tests: 12 unit, QA CR-1..5 (API), CR-UI-1..3 and MG-1..2 on screen against the rebuilt stack; the stale menu spec was brought up to date (it predated the outage, drug register, review, GST and finance entries); full unit suite 273 passing.

Deliberately not yet: notifications. The alerts engine already tells people about stock counts, licences, deposits and the weekly review, so the register is report-only and adds no second set of messages; a `compliance_late` alert kind (store head at late, Business Head at escalated) goes in with stage 5. Also not yet: the deposit-due and checklist items, "required" and "blocked" steps (stage 5), compliance in store health (stage 6).

Test note: UI specs must run without `QA_API_URL` (they log in through the stack's own API); API-only specs use `QA_API_URL=http://localhost:3100`. The two use different JWT keys.

## 2F. Stage 4 built: recognition (2026-10-25)

- Migration `112_recognition.sql` (+ rollback; applied to rgpdb and rgp_prodview; in the bootstrap list): `recognition_award` (person, rule, awarded day, evidence, seen, lapsed) and `recognition_note` (a line of thanks). No points table, no ranking anywhere.
- `modules/app/recognition/recognition-rules.ts` (pure, 10 unit tests): five habit measures from a person's own facts, newest first: accurate till (shifts in a row within Rs 50), customer capture (days running at or above the business's percentage, at least 5 bills a day, 7 days), refill caller (days running with a recorded call, pharmacy pack), beat your usual (days above their own weekday usual, paused when the week's discount share rose), compliance clean (days since their last late item). `decide` awards, lapses or does nothing; **an own item that is late or escalated pauses new awards and never takes a held one away**. A badge lapses only when the run is broken.
- `recognition.service.ts`: measures in a few set-based queries; nightly run at 00:30 and on read when older than 30 minutes; thresholds and switches come from the stage 1 `recognition` settings; the handover badge is not built (it needs delivery times by person, which the data does not yet carry). `GET /recognition/mine` (awards, progress per habit, whether paused and by what, notes, unseen count), `POST /recognition/seen`, `GET /recognition/team` (heads; name order; badges, paused flag, thanked flag), `POST /recognition/thanks` (heads, to people of their own stores, one line), `POST /recognition/run` (Business Head).
- Frontend: on the Staff view a celebration the first time a new badge or note is seen (one tap to dismiss, then it is marked seen), a banner when new badges are paused, the badge grid with progress and "how it is earned", and the notes; on the Owner and Manager dashboards a team card in name order with "Send thanks".
- Verified by hand on the QA database: ten accurate shifts awarded "Accurate till" with its evidence; a later bad shift lapsed it; the seeded rows were removed. A person with a late parked bill is held (the pause works end to end).
- Tests: 10 unit, QA RC-1..4 (API), RC-UI-1..2 (on screen); full unit suite passing.

Not yet: the on-time handover badge, monthly summary cards, notifications for badges (the Inbox and celebration carry them), the Personal view badges.

## 3. Order and dependencies

```
0 prereq -> 1 config -> 2 register ----> 5 do-this-to-continue
                 \                  \--> 4 recognition (needs 2 for pause)
                  \-> 3 shell/views --> 6 charts/health --> 7 setup
```
Stages 2 and 3 can run in parallel after 1. Recommended release points: after 3 (new dashboards), after 2+4 (reminders and badges), after 5 (force), after 7 (self-service configuration).

Rough total: S + M + L + L + M/L + M + L + M, about 8 to 10 weeks for one person.

## 4. Cross-cutting

- **Migrations** 109 to 113 (109 is the dashboard path, held until stage 3) each with rollback, added to `qa/scripts/bootstrap-db.sh` and applied to the prod copy before the live rehearsal.
- **Live data:** the live pharmacy has one store and 61k bills; generators must be idempotent and back-fill nothing older than go-live, so day one does not show a wall of "late" items.
- **Localisation:** English and Tamil messages for every alert kind and badge (existing message specs pattern).
- **Performance:** register generation under a second per store; dashboard queries measured on the prod copy.
- **Privacy:** no customer names on dashboards; evidence of awards references bills and shifts, not customers.
- **Rollout:** per-business flags for new menu, register steps (report-only, reminders, required, block), and recognition; start the live business at report-only.

## 5. Risks

| Risk | Mitigation |
|---|---|
| A flood of "late" items on day one | Start report-only, no back-fill, generators create only forward-dated items |
| Staff feel policed | Reminders and thanks ship before any force; escalation private; waiver and "not mine" paths |
| Config sprawl | Typed keys per scope, floors, one screen, defaults per business type |
| Shared Counter login hides who did what | Stage 0 named operator; recognition only to named people |
| Menu regroup confuses users | Flag, training note, old routes kept |
| Heavy dashboard queries | Measured on 61k bills; add indexes or materialised daily rollups only if needed |

## 6. Open points (do not block Stage 0 to 3)

1. Store override from the start, or business-level only (recommended: business-level, store override for targets).
2. Which settings a SaaS plan may limit.
3. Whether the Manager may change any setting (recommended: no).
4. Maximum waiver length default (proposed 7 days).
5. Whether Counter-role shared logins remain at all once Staff have own logins.

## 7. First step proposed

Stage 0 (a day), then Stage 1 and Stage 3's Owner and Manager views, so the owner sees the new dashboard early while the register is built underneath.

Stage 4 closed 2026-10-29: verified; Tamil wording, handover badge, Inbox card and thanks prompt deliberately left out.

## 2G. Stage 5 built: "do this to continue" and waivers (found built 2026-10-29)

- `compliance-rules.ts`: `gate` on an item (days past due, shift open or close) and `isRequired`; waivers already built in stage 2 (Business Head only, reason, expiry, longest from `waiver_max_days`).
- `compliance.service.ts`: `gate(user, store, phase)` lists outstanding required items, `enforce` refuses with 409 and the list unless each has a reason of 3+ characters; the reason is stored as an event (shown to the store head) and audited, and clears the gate for that day. `GET /compliance/gate`. Hooked into shift open (an unclosed earlier shift of the person) and shift close (stock count far overdue) in `store.service.ts`.
- Pharmacy drug licence block: off until the Business Head turns on `block_expired_licence`; a waiver lifts it. `compliance_late` alert kind added.
- Frontend: shift desk shows the gate card (`shiftdesk-gate`) with a reason box per item and "go ahead" / "stay here".
- Tests: QA GATE-1..4 (4/4 pass), CR-1..5, CR-UI pass. GATE spec now closes stale open shifts left by other specs first.
- Not done: dialog at login (the dashboard "To finish" list covers it), a screen-level test of the gate card, one shared reason for many items (a person with many unclosed shifts is asked per item).

## 2H. Stage 6 built in part: health, targets and charts (2026-10-29)

- Migration `113_metric_target.sql` (+ rollback; applied to rgpdb and rgp_prodview; in the bootstrap list): monthly sales target for the business or one store.
- `dashboard-health.ts` (pure, 8 unit tests): seven check scores and `combine` (business weights from the stage 1 `health` settings; a check with no data is left out and the rest scaled up; one check under `hold_below` holds the whole at Watch; below it, Act now).
- `dashboard-metrics.service.ts`: `GET /dashboard/health?storeid=`, `GET/PUT /dashboard/targets` (set by Business Head and Owner-operator only, audited, null clears), `GET /dashboard/metrics/` sales-by-month (12 months against the two years before), categories, customers (new and returning, counts only), busy-hours (weekday by hour, 90 days), payables (ageing buckets). All scoped by `DashboardService.scope`, for Business Head, Owner-operator and Store Head only (the counter and staff have `/dashboard/mine`).
- Frontend `app-owner-insights` on the Owner and Manager views: health card with the fact behind each check, target box (owner), five ngx-charts charts each with a "Show numbers" table; payables and the target box are owner only.
- Tests: 8 unit, QA HM-1..6 (API), HM-UI-1..2; the heaviest chart queries run in 3 to 130 ms on the 61k-bill copy.
- Not built yet: margin and cost (needs the cost coverage guard), tiles with spark lines and comparison arrows, finance snapshot, deliveries chart, tree map and cross-filter chips, drill-through to filtered list pages, the `metric_daily` roll-up (not needed at this volume), compliance weights read from per-store settings, brush/zoom. The Stock check shows "no data" until products carry a minimum.
