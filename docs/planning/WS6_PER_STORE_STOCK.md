# WS-6: Real per-store stock

**Date:** 2026-09-05
**Branch:** feature/shift-cash-phase1
**Status:** BUILT — migration 029, per-store availability math, invoice/sale store attribution,
inter-store transfer feature (backend + minimal UI), new QA spec `store-stock-transfer.spec.ts`.
**Supersedes** the lighter "transfer ledger only" option in `STORE_MANAGEMENT_ENHANCEMENTS.md`'s
WS-6 decision #2 — the user asked for the real per-store split instead, with these two decisions
locked first:

| # | Question | Decision |
|---|---|---|
| 1 | PO receiving | A purchase invoice picks a store (`purchase_invoice.store_id`); its stock lands directly there. |
| 2 | Backfill | Every existing invoice/batch backfills to the lowest-id store ("Main Store" in every environment seen). |

## Ground truth this builds on

Before this change, stock was global/pooled across the business: `product`, `purchase_invoice_item`,
`sale_item`, `product_qtychange` carried no store dimension at all. Only cash (`store_cash_account`,
`store_shifts`) was store-scoped. Sale creation (`sale.service.create`) resolved "the store" with
`select id from stores order by id asc limit 1` — hardcoded to the first store in the whole
database, regardless of which store the sale was actually happening at. `qa/seed/operations.ts`
documents this directly: *"Transactional history on store 1 (the API pins sales/shifts to the
first store)."*

## Design

**Availability formula** (used everywhere store-scoped stock is computed — `stock.service.findByCriteria`,
`sale.service.create`'s oversell guard, and the transfer service):

```
available_at_store(batch, S) =
    (home qty, only counted if the batch's invoice.store_id = S)
  - (sale_item qty sold, only where the sale's store_id = S)
  + (approved product_qtychange qty, only where its store_id = S)
```

A transfer is two `product_qtychange` postings linked by `transfer_id`: `TRANSFER_OUT` (negative,
at the source store, written at dispatch) and `TRANSFER_IN` (positive, at the destination store,
written at receipt). Between dispatch and receipt the stock is deliberately in neither store's
balance — it's in transit, not sellable at either counter. `store_stock_transfer` is the workflow/
audit wrapper (who requested/received, dispatched vs. short-received, cancellable while in transit);
it is not a second source of truth for quantity.

This formula is additive and backward compatible: pass no `storeid` and every existing caller
(reports, demand calc, the three `stock_view`/`inventory_view`/`product_items_view` DB views) is
untouched, computing the same business-wide numbers as before. Only `findByCriteria` and the sale
oversell check gained an optional store-scoped path.

**Why this doesn't break the existing single-store seed/suite:** every invoice the seed creates
lands on the one store that exists for business 1 (no `storeid` given → falls back to "first
store"), and every sale it creates now also resolves to that same store (frontend always sends the
current store; the seed doesn't, so it falls back the same way) — home store and sale store are
always equal for that data, so the formula reduces to exactly the old global math. The new
`store-stock-transfer.spec.ts` builds its own second store per test to actually exercise the split.

## What shipped

**Schema** (migration `029_store_stock.sql` / rollback):
- `purchase_invoice.store_id` — not null, backfilled to the lowest-id store.
- `sale.store_id` — nullable, backfilled from each sale's shift's store.
- `product_qtychange.store_id` + `.transfer_id` — nullable, backfilled to each batch's home store.
- `store_stock_transfer` — id, from/to store, purchase_item_id, qty, received_qty, status
  (`IN_TRANSIT`/`RECEIVED`/`CANCELLED`), requested/received by + timestamps, notes.

**Backend:**
- `purchase-invoice.service.create()` — resolves `storeid` (payload, else first store), 400s only
  if no store exists at all.
- `sale.service.create()` — the hardcoded "first store" lookup now only a *fallback*; a `storeid`
  on the payload (which the frontend now always sends) is validated and used, both for the OPEN-shift
  lookup and for the oversell guard, which is now store-scoped.
- `stock.service.ts` — `createQty`/`createStockAdjustments`/`createStockAudit` default `storeid` to
  the batch's home store when not given; `findByCriteria` takes an optional `storeid` criterion.
- New `store-stock-transfer` module (entity, service, controller) under `stock.module.ts`:
  `GET /store-stock-transfers`, `GET /store-stock-transfers/available?itemid&storeid`,
  `POST /store-stock-transfers` (dispatch), `PUT /:id/receive`, `PUT /:id/cancel`. Gated by the
  existing `auditStock` permission (Business Head / Store Head privileged bypass) — no new
  permission-catalog migration, same fold-in precedent as the GST module.

**Frontend:**
- Purchase invoice form gained a required "Receiving Store" dropdown (defaults to the header's
  currently selected store).
- `sale-form.component.ts` now sends `storeid` (from `StoreContextService`) on every sale save —
  this is the fix for the hardcoded-first-store bug on the POS side.
- New `/secure/store/transfers` screen: a list of transfers (with Receive/Cancel actions) and a
  dispatch dialog (product search → batch picker → from/to store → live "available at source"
  check → quantity). New "Transfers" nav link on the Store page.

**QA:** `qa/specs/store-stock-transfer.spec.ts` — invoice defaults to a store when none is given;
a batch received at one store is invisible to another until transferred; dispatch/receive moves
the balance; over-dispatch is rejected; cancelling an in-transit transfer restores the source.

## Deliberately not done (scope decisions, not oversights)

- **The three DB views** (`stock_view`, `inventory_view`, `product_items_view`) and everything
  built on them (`findAllReady`, `findByProducts`, `findStockDemand`, reports) stay business-wide.
  Rewriting them for store-awareness has a much wider blast radius (pricing, the "ready to sell"
  POS list, demand analytics) than this workstream's ask, and nothing today needs a per-store view
  of those. Revisit if/when a second store is actually operating and those screens need splitting.
- **The POS product-search UI does not yet pass a store filter** — a cashier's "add item" search
  still shows business-wide batches, unfiltered by store. Sale *completion* is store-enforced
  server-side (the oversell guard is store-scoped), so an over-sell is rejected either way; not
  filtering the search list is a UX gap, not a correctness gap. Worth a follow-up once there's a
  second live store to make this concrete.
- **Stock list store filter** — `stock-products.component` doesn't yet expose a store dropdown in
  its UI (the backend `findByCriteria` supports `storeid` already; only the screen wasn't wired).
- **Batch splitting across more than two stores by re-transferring a partially-transferred batch**
  works (the formula composes), but the dispatch UI's "available" check is a single live number,
  not a running ledger view — fine for the current volumes, worth a proper ledger screen later.

## Not in scope

Everything else already deferred in `STORE_MANAGEMENT_ENHANCEMENTS.md` (multi-till hand-off,
per-business configurable sets, etc.). Cold-chain temperature logging (separate track).
