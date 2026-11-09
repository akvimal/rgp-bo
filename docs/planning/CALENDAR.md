# Calendar view: events, leave, roster, planning

Status: evaluated 2026-11-09. **Phase 1 built, verified and committed 2026-11-09 (ba8e4f7fc). Phase 2 built and browser-verified 2026-11-09, committed after.** Phases 3-4 not built; roster waits on how stores plan shifts today.

## Phase 1 as built

- API `api-v2/src/modules/app/calendar/`: `GET /calendar?from&to&store&types` (window max 100 days) and `GET /calendar/options`. One query per kind: holiday, leave, todo, licence, audit, followup, attendance. Pure rules in `calendar-rules.ts` (4 jest tests pass).
- Visibility: leave shows approved team leave to everyone in the store; pending requests and reasons only to the person, owners and Store Heads. To-dos: own, plus store pool; managers see their stores. Licences: owners and Store Heads (vendor licences owners only; the vendor master has no business id). Stock audits need `stockaudit.view`, follow-ups need `scheduleregister.view`. Attendance is your own only.
- Migration 174 (+ rollback) only grants the new `calendar.view` permission to every role that has the to-do list. No new table.
- Frontend `frontend/src/app/secured/calendar/`: custom month/week/day grid (no library, so no Angular 12 compatibility risk), kind chips and store filter (kept in the browser), dark-theme tones, menu entry under Home, role catalog entry. `ng build` passes (needs `NODE_OPTIONS=--openssl-legacy-provider` on Node 24). QA `menu-grouped.spec.ts` updated for `nav-calendar`.
- Verified 2026-11-09 on a scratch database `rgp_calendar` (copy of `rgp_todotest` plus migrations 156-174, in the `rgp-db-dev` container): migration 174 grants `calendar.view` to the 5 roles that have to-dos, is safe to re-run, and its rollback removes it. All seven queries run. Checked as Store Head, Sales Staff and Business Head: staff see approved leave only and reasons only on their own; managers see pending leave; staff get no licence, audit or follow-up kinds; to-do times are IST and overdue ones show red. Month view rendered correctly in the browser with seeded data.
- Browser-checked as Store Head: month, week and day views, the kind filter (hidden kinds show dimmed and struck through), click-through to the To-dos page, dark theme, and phone width (a 390px frame). On phones the month grid shows a coloured dot per entry and the day list below names them. Holidays and leave list before follow-ups and attendance. Licence titles use the vendor-list wording.
- Not checked in the browser: the Sales Staff view (checked through the API only), a store filter with more than one store, Tamil labels.
- Not built: near-expiry and refill layers, apply leave from the calendar (phase 2).


## Verdict

Worth building. About 70% of the data already exists, so the first release is a new view plus one aggregator endpoint. Roster and free-form events come later. Keep the calendar a **view over existing modules**, not a second source of truth.

## What already exists

| Source | Table or module | Calendar use |
|---|---|---|
| Leave | `hr_leave_request`, `hr_leave_day`, `hr_leave_type` | Who is off, pending approvals |
| Holidays | `hr_holiday` | Shaded days |
| Attendance | `hr_attendance` | Past presence and absence |
| To-dos | `todo_item`, `todo_template` (repeat rules) | Due tasks |
| Licences | `store_license`, `vendor_license` | Expiry dates |
| Stock audits | `stock_audit_plan` | Planned counts |
| Schedule-drug follow-ups | `schedule_rx_followup` | Follow-up dates |
| Compliance | `compliance` module | Deadlines |
| Audit log | `audit_event` | Past events |

Missing: a staff roster / shift-assignment table, and a free-form event table. Shift open/close exists only as a record of what happened.

## Phase 2 as built (ask for leave from the calendar)

- The calendar does not hold leave rules. It calls the existing `GET /my-hr/leave` (types, balances, role), `POST /my-hr/leave` (apply; back-date limit, stretch limit, balance, holiday and overlap checks, policy notes all come from the server) and `POST /my-hr/leave/:id/cancel` (withdraw while pending). Needs `myhr.apply` and an active staff record; `GET /calendar/options` returns `canApply`.
- New `GET /calendar/leave-cover?from&to`: for the asker's store, per day, who is already away (approved, named) and how many are waiting (counted, not named), the team size, and a level (`ok` / `tight` more than half away / `none` nobody left) from the pure `coverLevel` (tested). Informational only; it never blocks.
- Screen: an "Ask for leave" button opens a form above the grid. Dates come from two clicks on the grid (first day, then last day; a day before the first starts again) or the date boxes; the range is shaded. Shows the type hint (shared with My HR through `my-hr/leave-hint.ts`), the balance, and the cover lines. Server errors (for example the "at most 2 days together" rule) show in the form. Your own waiting request in the day list has Withdraw. Leave entries carry `mine`.
- Chosen over drag: click-click works on touch and with the keyboard; drag-select can be added later.
- Verified in the browser as Sales Staff on the scratch database: open form, click-click range, hint and balance, cover line, server rule error, a valid request (counted 1 day because the 20th is a holiday), the entry shown as waiting, Withdraw (row CANCELLED). Leave entries now use the staff record name first, as the leave service does.
- Not done: a manager approving from the calendar (use Leave requests), leave for someone else, drag-select, a Playwright spec for the calendar.

## Design

**Aggregator endpoint:** `GET /calendar?from&to&store&types` returns normalised entries `{type, title, start, end, store, user, status, link}`. Each source is a small provider function (same idea as the packs/hooks work). Source tables are untouched. Visibility reuses the alert recipients logic (`alert-access.ts: canSee`: owners / managers / staff, store filter).

**New tables (one migration):**
- `roster_shift`: store, user, date, start, end, shift template, status (draft / published). Checked against approved leave; weekly hours feed attendance and payroll.
- `calendar_event`: title, type, store, start, end, all-day, repeat rule (reuse the `todo_template` repeat vocabulary), attendees, reminder offset, optional link to a to-do.

**Reminders** go through the alerts engine (bell, Settings > Alerts snooze, staff Telegram). No second reminder mechanism.

**UI (Angular 12):** `angular-calendar` or `@fullcalendar/angular` v5 (not PrimeNG-native).
- Month, week, day views; list view for mobile.
- Colour by type, filter chips, store selector.
- Click empty slot to add event/shift; click entry to open its source screen.
- Drag-and-drop for roster and events only; past entries are not draggable.
- Dark theme and Tamil labels like other screens.

## Phases

1. **Read view** (about 4-5 days, no migration): aggregator, month/week UI; leave, holidays, to-dos, licences, audits, compliance.
2. **Leave from the calendar:** drag across days to apply, using the existing leave service; show approvals and team clashes ("2 of 4 pharmacists already off").
3. **Roster** (about 1-1.5 weeks): `roster_shift`, weekly grid per store, copy last week, publish and notify. Conflict and minimum-cover rules are the real work.
4. **Events** (about 3-4 days): `calendar_event`, repeats, attendees, reminders.

## Ideas for a pharmacy or retail shop

**Compliance and licensing (highest value for pharmacy)**
- Drug licence, FSSAI, shop establishment, GST filing due dates with countdown.
- Pharmacist registration renewals (store cannot operate without a valid pharmacist).
- Fire extinguisher service, pest control, scale calibration, fridge calibration, cold-chain temperature log checks.
- H/H1/X register review dates; drug inspector readiness.

**Stock and buying**
- **Near-expiry calendar**: batches expiring per month with return-to-vendor windows (near-expiry is not yet built in alerts).
- Expected PO delivery dates, vendor visit days, vendor payment and cheque due dates.
- Scheme and offer start/end dates; stock count and cycle-count schedule.

**Sales and demand**
- Festival and season overlays (Pongal, Diwali, monsoon fever season, school reopening) with last year's sales for that week.
- Sales heat-map: month grid coloured by revenue.
- Chronic-patient refill due dates with a call worklist (links to customer relationships).
- Medical camps, health-check days, vaccination drives.

**Staff**
- Birthdays and anniversaries (feeds recognition).
- Probation end, appraisal, training dates.
- Salary day, payroll lock, advance recovery.
- Minimum-cover warnings, e.g. no pharmacist on Sunday evening.

**Money**
- Rent, EMI, electricity, insurance, tax due dates (expenses module).
- Bank statement import and reconciliation reminders; Paytm settlement expected dates.

## Risks and open decisions

- **Library:** Angular 12 limits calendar libraries to old versions; adds to the debt in the Angular upgrade note.
- **Roster rules:** is minimum-cover a warning or a block? Is a published roster binding for attendance?
- **Roster need:** confirm how stores plan shifts today (paper, WhatsApp, fixed rotation). A fixed rotation may need only a template, not a planner.
- **Scope creep:** items are edited on their own screens, except roster and free-form events.
- **Prod DB:** `api-v2/.env` points at the production database; switch to a dev DB before any build or test.

## Recommendation

Build phases 1-2 first, with licence expiry, near-expiry batches and refill reminders as headline layers. Hold roster until the shift-planning question is answered.
