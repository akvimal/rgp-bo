# Invoices marked for payment: stages, filters, bulk actions, payment queue

Built 2026-11-18 (no migration). Follows "mark ready for payment" (migration 224). Choices taken from the proposal: finance lands on Ready to pay, the person who receives goods on Needs marking; Pay chosen reuses the pay run (one per vendor); the Payment queue is a new tab and **Outstanding and By vendor stay** for now (folding them in is a later step once the queue has been used).

## The list (Purchase > Invoices)
- **Stage pill** in the Payment column: Draft, Awaiting invoice, **Needs marking** (amber), **Ready for payment** (green, with a green row), On hold, Awaiting approval, Part paid, Paid. The API still says "Not ready" / "Unpaid"; only the label changed.
- **Stage tabs with counts**: All, Needs marking, Ready to pay (count and amount), Awaiting approval (when approval is on), On hold, Paid. The tab last used is remembered in the browser; first time, a role that may record payments opens on Ready to pay, a role that may add purchases on Needs marking, anyone else on All. The summary cards stay.
- **More filters**: falls due (overdue, in 7 days, later), marked ready from/to, amount from/to. API: `due`, `readyfrom`, `readyto`, `min`, `max` on `/purchases/search`, `/summary`, `/vendors`, `/payment-queue`. Sort by Ready since (`sort=ready_on`).
- **Ready since** column in the ready views: date, how long ago, by whom, and the note.
- **Choosing invoices** (Needs marking and the ready views): a checkbox column and a sticky bar showing how many are chosen and the balance. Needs marking: **Mark ready for payment** with one note (`POST /purchases/payment-ready-bulk`). Ready: **Pay chosen** (a dialog with an amount per invoice, one pay run per vendor) and **Take back to Needs marking** (`POST /purchases/payment-unready-bulk`). Each invoice is checked on its own; the ones that cannot be done come back with the reason.

## Payment queue (Purchase > Invoices > Payment queue)
`GET /purchases/payment-queue`: invoices marked ready, owed, not on hold and not waiting for approval, grouped by vendor (overdue first) with each vendor's total, overdue amount, oldest due date; totals at the top (ready, overdue, due in 7 days). Choose a vendor or single invoices, Pay chosen, or Pay on one row. The list's filters apply.

## Alert
`invoices_ready_overdue` (built-in rule, warning): invoices marked ready, unpaid, past their due date and not on hold, with a count and amount; links to the list's ready-overdue view. English and Tamil text (the Tamil wants a native speaker's read).

## Not built
- A Dashboard card and a menu badge count for ready-to-pay invoices.
- Folding Outstanding and By vendor into the queue.
- A marked-by filter and multi-vendor filter.

Tests: `qa/specs/invoice-payment-queue.spec.ts` (PQ-1..6, API and screens), `invoice-view.spec.ts` (PINV-1 and PINV-7 now count Needs marking and compare the overdue chip at full invoice totals), alert unit specs.
