# Purchase invoice list: four cards instead of eight

Built 2026-11-09 (uncommitted). Page: Purchase > Invoices (`invoice-list.component`), figures from `GET /purchases/summary` (`invoice-view.service.ts`).

## Problem
Eight cards (Pending, Overdue, Due in 7 days, On hold, Awaiting approval, Paid, Drafts, Awaiting invoice) counted the same invoices more than once: Pending is everything owed and Overdue, Due in 7 days, On hold and Awaiting approval are slices of it (on a sample database Pending and Overdue were the same figure). They also mixed measures (balance for the owed cards, total for Paid, Drafts and Awaiting invoice) and wrapped onto two rows.

## Now: four cards, each invoice counted once
| Card | What it is | Click |
|---|---|---|
| **Ready to pay** | owed, not on hold, not waiting for approval (balance) | the card shows all of it; its three parts, **Overdue**, **Due in 7 days** and **Later**, each filter the list |
| **Held up** | cannot be paid yet: **On hold**, **Awaiting approval** (only when approval is on), **Awaiting invoice** (with the oldest days) | each line filters the list |
| **Not received** | drafts: entered, not received, nothing owed | the drafts |
| **Paid** | settled invoices | the paid list |

Everything owed is exactly Ready + On hold + Awaiting approval, and Ready is exactly Overdue + Due in 7 days + Later (the QA spec PINV-7 checks both, counts and amounts).

## Notes
- The summary keeps every old key (`pending`, `overdue`, `due7`, ...) and adds `ready`, `ready_overdue`, `ready_due7`, `ready_later`; the list endpoint accepts the same four as `view`. The old views still work from a URL, and the Outstanding screen still opens on everything owed, with a line offering "Show only what is ready to pay".
- **The headline is lower than the old Pending** by what is on hold or waiting for approval: that is the point, as those cannot be paid.
- The Awaiting approval line shows only when the business has switched approval on.
- Decisions taken without an answer (recommended in the suggestion): held and awaiting-approval invoices are outside "Ready to pay"; Drafts and Paid stay as small cards.
