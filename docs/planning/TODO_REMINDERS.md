# To-do list with reminders, and KPI goals

Status: designed 2026-11-05. **Phase 1 built 2026-11-05** (migration 155, `api-v2/src/modules/app/todos/`, `frontend/src/app/secured/todos/`, alert kind `todo_due`); phase 2 (KPI items) **deferred by the user 2026-11-05**; phase 3 not built. Decisions below are the user's.

## Decisions

1. A to-do can be given to **a person or to a store pool** (any counter or staff login at that store may tick it; the shared Counter login is why).
2. **Managers can assign to others**: an owner to anyone in the business, a Store Head to the people of their own stores. Anyone may keep a personal to-do.
3. **KPI goals with on-track status**, and KPI **reminders** (rating reminders, checkpoints), each with an interval.
4. Reminders go through the **alerts engine** (bell, Settings > Alerts snooze, staff Telegram), not a second mechanism.

## What exists and is reused

- `alerts.service.ts` runs every minute, turns each rule's findings into `notification` rows (one open row per rule and `dedupe_key`), and resolves a row when its finding stops appearing. Read, dismiss and snooze are per person (`notification_state`).
- Who sees a notification is the rule's `recipients` (`alert-access.ts: canSee`): roles `owners` / `managers` / `staff`, named `userids`, and the store filter.
- The shared Counter login is not a person (`NOT_A_PERSON`); work done on it is attributed to the acting operator (`actinguserid`).
- `hr-kpi-engine.service.ts` measures system KPIs (sales value, discarded bills, cash variance, grievances, inquiries closed or late, audits done or late, suggestions taken, absent days) for a **month** window. Manual KPIs are rated by a manager. Payroll locks the month (`payrollLocked`).
- The compliance register already chases the fixed items (stock count, outage kit, weekly review, shift close, licence). To-dos must not duplicate those.

## Data model (migration 155)

`todo_item`
- `id`, `business_id`, `store_id` (null = whole business)
- `kind` : `TASK` | `KPI_CHECK` | `KPI_GOAL` | `KPI_RATING`
- `title`, `notes`, `priority` (low / normal / high)
- `assignee_user_id` (null when a pool), `pool` boolean (the store's staff), `assigned_by`
- `due_on` timestamptz, `status` : `OPEN` | `DONE` | `SKIPPED`
- `completed_by` (the acting operator), `completed_on`, `done_note`
- `template_id` (the repeat it came from), `metric_id`, `target`, `window_start`, `window_end` (KPI kinds)
- `created_by`, `created_on`, `archive`

`todo_template` (the repeat)
- `id`, `business_id`, `store_id`, the same fields as an item (kind, title, assignee or pool, KPI settings)
- `repeat` : `DAILY` | `WEEKDAYS` | `WEEKLY` (days) | `MONTHLY` (day N or last) | `EVERY_N_DAYS_AFTER_DONE`
- `at_time`, `starts_on`, `ends_on`, `skip_if_open` (default true), `active`
- `next_due_on`

`notification` gains `audience jsonb null`. A finding may carry its own recipients, and `list`, `visibleOne` and the Telegram sender use `coalesce(n.audience, rule.recipients)`.

## The engine change (small, contained)

- `Finding` gets an optional `recipients`.
- `reconcile` stores it on the notification and passes it to `send`.
- The `todo_due` kind returns one finding per open to-do that is due or overdue:
  - `key = todo:<id>:<stage>`, stage = `soon` / `due` / `overdue` / `escalated`
  - person to-do: audience is that person
  - pool to-do: audience is the staff role at the store
  - `escalated`: audience is the assigner and the store manager
- A to-do that is ticked drops out of the findings, so its alert resolves by itself.
- Stages (set per to-do, with defaults): heads-up 1 day before, a nudge when due, daily while overdue, escalation after N days (default 3).

## Repeats

A tick on an item, or a tick on the clock (a nightly job), creates the next occurrence from its template. With `skip_if_open`, a new copy is not created while the last one is still open, so an ignored to-do does not breed. Missed occurrences are marked `SKIPPED` and counted, so a manager can see "done 18 of 22".

## KPI items

All four are `todo_item` rows made from a template with an interval (weekly or monthly).

- **KPI_RATING** (manual KPIs): "Rate the manual KPIs of your team for October", due before the payroll month is approved. Done when every manual rating for the period exists.
- **KPI_CHECK**: "Look at cash variance this week." The card shows the live figure and evidence from the engine ("3 of 12 shifts off"). Ticked by hand.
- **KPI_GOAL** (system metrics only): a target for a window. The status is worked out from the engine and shown on the card and the list:
  - *lower is better* (discards, cash variance, late items): MET if at or under the target when the window ends; AT_RISK once the figure passes 80% of the target before the window is 80% gone; MISSED when over.
  - *higher is better* (sales, items closed): AT_RISK if the pace (value so far divided by days gone, times the window) falls short; MET once reached.
  - `todo_due` raises an alert when a goal turns AT_RISK or MISSED (once per status change).
- `measure()` in the KPI engine takes `[start, end)` instead of a hard-coded month. This is the one refactor; the monthly call passes the month.

## API and screens

- `GET /todos?scope=mine|team|store`, `POST /todos`, `PUT /todos/:id`, `POST /todos/:id/done|reopen|snooze`, templates under `/todos/templates`.
- **Rules:** a manager assigns to a person of their stores or to a store pool; others only create their own. Pool items are ticked by any login at that store and attributed to the acting operator.
- **My tasks** page: Today / Overdue / Later, KPI goal cards with status, quick add with repeat. A bell link opens the item.
- **Manager view:** the team's open and overdue items, with completion rate per person.
- **Settings > Alerts** shows the `todo_due` rule like the others (stages and escalation days as its numbers).
- Phase 3: the existing sentence assistant can draft a to-do ("remind Ravi every Monday to check the fridge").

## Permissions

New resource `todos` with actions `read`, `add`, `assign`, `manage_kpi`. Business Head and Owner-operator get all; Store Head gets `read`, `add`, `assign` for their stores; staff get `read` and `add` (their own). Migration grants by role name, as 150 and 154 do.

## Phases

1. **Core**: migration, service, repeat job, `todo_due` alert with per-person audience, My tasks page, pool and assign. Telegram comes with the alert.
2. **KPI**: `measure()` windows, KPI_RATING and KPI_CHECK, then KPI_GOAL with status and its alert.
3. **Extras**: a "My day" view that adds open compliance items and assigned inquiries or audits (read-only, with a source badge), starter templates by business type, sentence-to-to-do.

## Risks

- **Alert fatigue**: stage defaults are conservative, KPI items default to weekly, and a person can snooze.
- **KPI sensitivity**: a person sees only their own goals, a manager their team's; the same visibility as the My HR screens.
- **Duplicates**: compliance items are shown, not copied.
- **Pool ticks**: attributed to the acting operator, so a shared login does not hide who did it.

## Tests

Unit: repeat date maths (month end, weekdays, every N after done), stage selection, goal status maths. Integration against a scratch database: a finding with its own audience is seen only by that person, a pool item is seen by store staff only, a ticked item resolves its alert, a template does not breed copies. Playwright: add, assign, tick, snooze, goal card.
