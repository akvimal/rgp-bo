# Manage Delivery: fewer fields, who confirmed it, and what the delivery cost

Built 2026-11-09 (committed bde89a3bf; the shift choice below added after, uncommitted). Screen: Sales > Deliveries > Manage (`sale-delivery.component`); API `PUT /deliveries/:saleid` (`sale-delivery.service.ts`); migration `179_delivery_cost.sql`.

## What it was
About 19 inputs: status, method, scheduled date, assigned to, courier partner, delivered at, failure reason, a "use sale customer" checkbox and three receiver boxes, delivery charge, actual cost, payment mode, collection status, confirmed (yes/no), confirmed by, confirmed at, remarks. The cost was only a number: nothing said who paid it or how, so the money left no trace on the cash or expense side. The time boxes were filled in UTC (5½ hours off).

## Now
**The screen** asks only what most deliveries need:
- **Status** with two quick actions. **Mark delivered** sets Delivered, the time now (the clock on the wall), and the delivery as confirmed by the person at the counter. **Failed** asks why.
- **Delivered by**: our staff (a list of the store's people) or a courier (a list of partners) in one choice, instead of method, assigned to and courier partner. The day to deliver shows only until it is delivered.
- **Receiver** in one line with a Change link (the three boxes and the checkbox appear only when changed).
- **Cost of delivery** and **how it was paid**: cash from the counter, digital (UPI, bank transfer, card, cheque, with a reference), not paid yet, no cost, or **already recorded as an expense** (below).
- **Confirmed by**: the person at the counter (the operator selected, else the person logged in), with a Change link. Times are shown as typed.
- Charge to customer, cash on delivery and remarks are under "More" (money at the door appears only when the payment mode is not prepaid).

**Paying the cost** (the server does it; the delivery keeps a link to the entry):
| Way | What happens |
|---|---|
| Cash from the counter | an entry on the open shift's cash ledger (category logistics = Transport and courier, described "Delivery #1234 to Priya by Ramesh"); the shift's expected cash goes down. Needs an open shift; with none the screen says so. A warning if the drawer would now be expected short. |
| Digital | an expense in the Expenses ledger under Transport and courier, with the mode, the reference as bill no, payee the courier or person. It follows the Expenses approval rules (counter staff's wait for the Store Head, and the person is told). |
| Not paid yet | nothing is posted; the list shows "Cost unpaid". |
| No cost | the cost becomes 0. |

**Which drawer pays (cash):** the screen names it ("Paid from Morning, opened by Asha") from `GET /deliveries/:saleid/cash-shifts`. It is the person's own open shift (the store's one open shift where shifts are by time). A Store Head or above, where there is something to choose (several drawers open, or none of their own), gets a "Pay from the drawer of" list of the store's open shifts; the choice is sent as `costpaid.shiftid` and the server checks it is open at that store and that the person may (anyone else naming another person's shift is refused). The entry records the person who posted it as well as the drawer.

Saving twice posts nothing twice. A changed cost updates the same entry while it can still change (cash: its shift is open; expense: still pending). When it can no longer change (a closed shift, an approved expense) it is refused with the reason and pointed to the Cash or Expenses screen. Switching the way takes the old entry back first when it can be. A failed, cancelled or delivered delivery can all carry a cost.

## Costs and expenses that were already recorded separately (the VPS)
Linking changes no money: the entry stays as it is and is **never edited or deleted from the delivery**; unlinking only lets go.
- **From the delivery:** "Already recorded as an expense" lists the cash drawer expenses and Expenses entries around the delivery's day at its store that are not another delivery's cost, exact amounts first, with a "likely" mark. Picking one makes its amount the cost (an amount that differs is refused unless the entry's amount is used). Choosing cash or digital for a new payment first shows any entry of that exact amount around the date, with a "Link this" button, and the server adds a warning if a likely duplicate exists when a new payment is posted.
- **In one go:** a banner on the Deliveries page says how many deliveries have a cost not linked to an expense, and "Review matches" lists the pairs that are **sure**: exactly the same amount, the same store, within three days, and the entry says it is about a delivery (the logistics category, or "delivery", "courier", the bill number or who delivered in its words), and the only such pair for both the delivery and the entry. Everything else is left to be decided on the delivery itself.
- One entry belongs to one delivery (unique indexes, and checked before linking).

## Data
Migration 179, additive: `sale_deliveries.cost_paid_via` (CASH, DIGITAL, UNPAID, NONE), `cost_paid_mode`, `cost_paid_ref`, `cost_paid_on`, `cost_paid_by`, `cash_entry_id`, `expense_id`, `cost_linked`, `confirmed_by_user`. "Logistics" is added to the cash drawer's expense categories (it was already mapped to Transport and courier in the expense report). Old deliveries keep working with the cost unsaid; the list shows what has been said ("Paid in cash", "Cost unpaid", ...).

## Checked
- 11 and 7 unit tests of the cost rules and the matching (`delivery-cost-rules.spec.ts`, `delivery-cost-match.spec.ts`), 8 of the dialog's helpers (frontend). The rules test found one real bug while being written (a link request with no `via` was ignored).
- Playwright against a scratch database: `delivery-cost.spec.ts` DELCOST-1 to 7 (cash posting and expected cash, saving twice, change and take back, confirmed by the person logged in, digital with pending then locked once approved, refusals, linking existing cash and Expenses entries, a linked entry is never changed or deleted, the amount rule, the duplicate warning) and `delivery-manage.spec.ts` DM-1 to 3 with real clicks (the short dialog, mark delivered, cost lands on the shift, errors shown on the screen, the banner, the bulk review, linking from the delivery, unlinking). Migration 179 applied, rolled back and applied again.
- The existing sales (delivery) and delivery-partner specs pass. 18 of 30 tests in `cash.spec.ts` and `expenses.spec.ts` fail in the scratch database, **and fail identically on the original code** (shift opening is refused, the store-head limit differs from what the test expects), so they are the database, not this change.

## Not built / to decide
- **Not paid yet** is a flag and a label, not a courier payables list.
- Anyone who can save a delivery can post the cost from their own open shift (under the Expenses approval rules); only a Store Head or above can pay from another shift.
- A cost posted in cash to a shift that is later reopened is treated as editable while that shift is open.
- The server stores times as typed (the shop's wall clock); a server that did not run on UTC would shift the display.
