# Store checklists and system tasks

Built 2026-11-18 (migration 223). Replaces the Outage kit page.

## What changed
| Was (Outage kit page) | Now |
|---|---|
| Weekly 9-item readiness check | The **Outage readiness** checklist, one of several lists on **Checklists** (`/secure/checklists`). `/secure/outage` redirects there. |
| Price list printout (PDF/Excel) | Stands alone: **Print price list** on Pricing > Prices, and on the Outage readiness list. API `GET /outage/price-list`. |
| Outage procedure PDF | Button on the Outage readiness list. API `GET /outage/procedure`. |
| Outage log (events) | **Retired.** `outage_event` is left in the database, unused. |
| `outage_kit` alert, `outage_check` compliance item | Kept; they read `checklist_run` (template `outage_readiness`) instead of `outage_readiness_log`. |

## Checklists
- Shipped in code (`checklists/checklist-rules.ts`): Outage readiness (weekly), Opening, Closing, Monthly housekeeping.
- A store (Store Head) or the business (owner only) keeps its own copy in `checklist_template`; store beats business beats shipped list. Stores can add their own lists, hide a shipped one, or put one back.
- Item kinds: tick, text (e.g. last bill book number), and automatic (the price-list item ticks itself when the list was printed in the last 7 days).
- Each run is a `checklist_run` that keeps the wording as ticked. Old readiness checks were copied across by the migration.
- Permissions: `checklists` `view` (fill in; given to everyone who bills; the old `outage` resource still counts) and, from migration 225, `checklistsetup` `manage` (admin: change, add and remove lists, set recurring tasks) on its own page, **Settings > Checklists** (`/secure/settings/checklists`). The owner roles set up for any store or the whole business; a Store Head only for their own stores (the API refuses business scope and other stores). Reading the recurring-task setup needs `manage` too. The Checklists page is for filling lists in only.

## System tasks (weekly and monthly to-dos)
- Library in `checklists/system-tasks.ts`: outage check, price list, weekly review, negative/expired stock (weekly); stock count, housekeeping checklist, GST report check, cash book vs bank, drug register [pharmacy pack] (monthly).
- Each is a repeating **store-pool** to-do (`todo_template.system_key`), made for every store that sold in the last 60 days. Setting per store or per business (`system_task_setting`): on/off and day. Synced on save and nightly (03:30).
- A task the system can see closes itself: completing the checklist, printing the price list, signing the weekly review (`TodoService.completeSystemTask`). The others are ticked by hand.
- System repeats cannot be stopped from the to-do list; switch them off under Settings > Checklists > Recurring tasks.
- To-do rows carry a `link`; the to-do list shows an **Open** button.

## Not built / notes
- Monthly tasks other than those above (stock count, GST, bank, drug register) are tick-by-hand; no auto-close yet.
- Alert `outage_kit` and the to-do overlap by design; the alert only fires when the check is late.
- Tests: `api-v2/src/modules/app/checklists/checklist-rules.spec.ts`, `qa/specs/checklists.spec.ts` (CHK-1..5).

## Order of the checklists (migration 228)
- The order the lists are shown in (the buttons on the Checklists page and in Settings > Checklists) is kept per store, or by the owner for every store without its own (`checklist_order`, an ordered array of keys). Store beats business beats the order shipped in code; a list not named in the order (one added later) comes last. Settings > Checklists > Change the order has up and down arrows, a save, and Put back to the shared order. API: `PUT/DELETE /checklists/order` (same scope rules as editing a list); the overview carries `ordersource`.
- Fixed on the way: `delete/update ... returning` through `manager.query` returns `[rows, count]` here, so `result.length` was always 2 (a reset that removed nothing reported success; the system-task close count was inflated; the approval-rule setting never inserted a missing row). `core/db-result.ts` `affectedRows()` now answers "did it change anything" in those places.

## Scheduling a checklist (migration 229)
- Any checklist has a schedule: **Not scheduled, Every shift, Daily, Weekly (a weekday) or Monthly (a day, 0 = the last), at a time.** A store keeps its own, the owner can set one for every store without its own, and with neither the shipped one applies: outage readiness weekly (Monday 09:00), opening daily 09:00, closing daily 21:00, monthly housekeeping monthly (5th); a checklist a store adds is not scheduled. Set by the same people who edit lists (`checklistsetup`): a Store Head for their store, the owner for any store or the whole business. API `PUT/DELETE /checklists/:key/schedule`; the overview carries `schedule` (cadence, day, time, source, label).
- **Daily, weekly, monthly** make a repeating to-do in the store's shared list ("Complete the Opening checklist", system key `checklist:<key>`, link to the checklist), kept in step by the same sync as the system tasks (on save, nightly 03:30, when the settings page opens). A schedule set after today's time has passed starts tomorrow.
- **Every shift** makes a to-do when a shift opens (`ChecklistsService.shiftOpened`, called from `createShift`, never fails the opening): for the person whose shift it is in a staff-based store, else the shared list; due when the shift is planned to end, else eight hours on.
- Completing the checklist closes its to-dos (`completeSystemTask('checklist:<key>')`). "Up to date" follows the schedule (every shift and daily: a day; weekly: a week; monthly: a month).
- The two system tasks that were tied to a checklist (`outage_check`, `monthly_housekeeping`) are gone from the system-task library: what stores had set for them became those checklists' schedules and their to-dos kept going under the new key. The Recurring tasks tab keeps the other system tasks.
- Overlap to know: opening and closing a shift already ask for the shift's own opening and closing checklist inside the shift flow (`shift_checklist_log`, set under the store's cash settings). The Opening and Closing lists here are separate and now have their own to-dos; folding the two together is a later decision.
- Rollout: every trading store gets two daily to-dos (opening, closing) at the first sync after deploy unless the owner schedules them off.
