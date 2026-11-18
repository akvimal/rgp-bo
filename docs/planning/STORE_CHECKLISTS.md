# Store checklists and system tasks

Built 2026-11-18 (migration 223). Replaces the Outage kit page.

## What changed
| Was (Outage kit page) | Now |
|---|---|
| Weekly 9-item readiness check | The **Outage readiness** checklist, one of several lists on **Checklists** (`/secure/checklists`). `/secure/outage` redirects there. |
| Price list printout (PDF/Excel) | Stands alone: **Print price list** on Products > Master, and on the Outage readiness list. API `GET /outage/price-list`. |
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
