# Customer commitments (orders taken at the counter, paid in advance)

Status: built 2026-11-13 (migration 190), uncommitted. Backend verified against a scratch copy of the dev database (SQL, service flow, tender, hold, void); screens compile (AOT) but are not yet driven in a browser.

## What was built
- `sql/migrations/190_customer_commitments.sql` (+ rollback): `customer_commitment`, `customer_commitment_line`, `customer_commitment_payment`, and `sale.commitment_id` / `sale.commitment_amount`.
- `api-v2/src/modules/app/commitments/`: rules (`commitment-rules.ts`, tested), database helpers (`commitment-db.ts`: receipt allocation, hold guard, tender check/record/reverse), service, controller (`/commitments`).
- Purchasing: `syncRequestFulfilment` also covers the linked commitments (oldest first), sets READY and the hold.
- Billing: `commitmentid` / `commitmentamt` on the bill, counted in the payment total; a void gives the advance back; the stock check refuses to sell goods held for others.
- Shift: advances are in the shift digital total (`SHIFT_DIGITAL_SQL`) and the cash drawer ledger (`COMMITMENT_ADVANCE` / `COMMITMENT_REFUND`); the shift screen shows them.
- Alerts: kind `customer_commitment` (arrived and customer not told, hold ending, hold over, needed-by passed). The old request alert skips requests raised from a commitment.
- Screens: Customer orders (`/secure/commitments`) with a New order dialog and an order page; "collect it" under the till's payment.
- Not built: hold-days setting screen (the value is `app_setting` key `commitment_hold_days`, default 7), linking from the purchase requests screen (link is made from the order page), WhatsApp/SMS.

## The case
A customer asks for a product the store does not have. The store orders it, the customer pays the whole amount or an advance now, and buys it on a later day. Staff or the Store Head carry on with the normal purchase flow with the customer linked.

## Decisions (from the owner)
- **One commitment, many lines.** A commitment is a booking: customer, store, needed-by date, lines (product, quantity, agreed price), one advance balance.
- **The advance is earmarked to the commitment**, not pooled into the customer's store-credit wallet. It is settled on the future bill as a payment type. On cancellation it is refunded to the original mode, or moved to wallet credit by a deliberate step.
- **Money is counted in the shift it was taken in.** Cash goes into that shift's expected cash, UPI/card into that shift's provider total, so the close tallies with the drawer and the terminal.
- **Hold for N days** once the stock arrives (store setting), then release with an alert; the advance stays earmarked.
- **Telling the customer:** staff alert and a call worklist now; leave a place to plug WhatsApp/SMS in when that is built.

## Data
- `customer_commitment`: id, business/store, customer_id, status (REQUESTED, ORDERED, ARRIVED, READY, COLLECTED, CANCELLED), needed_by, hold_until, notified_at, notified_by, sale_id (the bill that settled it), notes, audit columns.
- `customer_commitment_line`: commitment_id, product_id (or requested_name for an unlisted product), qty, agreed_price, qty_received, purchase_request_id, state.
- `customer_commitment_payment` (the advance ledger): commitment_id, amount (positive for a receipt, negative for a refund or an application on a bill), mode (CASH or DIGITAL), provider/method/ref for digital, shift_id (the shift it was taken in), sale_id when applied, created_by.
- A line links to `purchase_request` (already has customer name/phone, needed-by and source from migration 148); a purchase line can carry lines from several commitments plus extra stock.

## Flow
1. Counter: take the order, take the advance (cash or digital). The receipt is stamped with the open shift.
2. Purchasing: the request or PO line shows the pending commitments for the product; staff tick which it covers. More quantity than the commitments is allowed (the rest is plain stock).
3. Invoice received: linked lines are matched by quantity (oldest commitment first), status becomes ARRIVED/READY, `hold_until` is set, the received batch is reserved for it, and an alert goes to the store's staff with a worklist (customer, phone, product, balance due).
4. Customer collects: the sale screen picks the commitment, loads its lines and applies the advance as a payment type (no cash or digital in this shift, it was counted earlier). The remainder is paid normally.
5. Hold expires or the customer cancels: the reservation is released with an alert; the advance is refunded or moved to wallet by a staff step.

## Shift tally (the important part)
- Extend the shift digital query (`SHIFT_DIGITAL_SQL` in `api-v2/src/modules/app/sales/digital-payment.ts`) with a branch for commitment receipts with mode DIGITAL by provider, so close, summary and digest all agree.
- Cash receipts add to the shift's expected cash alongside the cash from sales; refunds paid out of the drawer are a ledger withdrawal like other refunds.
- An advance applied on a bill is a non-cash, non-digital tender, so nothing is counted twice.
- A receipt in a closed shift is never edited; a correction is a new entry in the open shift.

## Open items to settle at build time
- GST: an advance for goods and the later invoice. Check with the CA whether anything has to be issued at receipt; the bill is the tax invoice either way.
- Who may take, refund or move an advance (suggest sales staff take; Store Head refunds or moves).
- Where the reservation lives: a hold on the batch or a hold quantity on the product at the store. Check how stock `balance` is computed before choosing.
- Partial arrival (some lines or a short quantity): lines move independently, the commitment is READY when at least one line is.
- A cancelled line with part of the advance: refund is whole or a manual amount, with a reason.
- Reports: commitments pending, advances held (a liability figure for the owner), overdue holds.

## Related
Customer store credit (migration 056), purchase requests (148), alerts engine, shift close (`store.service.ts` closing digital), delivery charge digital tally (migration 189).
