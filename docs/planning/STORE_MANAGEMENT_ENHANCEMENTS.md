# Store module — enhancement program

**Date:** 2026-09-05
**Branch:** feature/shift-cash-phase1
**Status:** All nine workstreams done, verified live, and independently code-reviewed (2026-09-05):
full stack rebuild, migrations 029-035 applied, `qa/seed` run, complete qa/ suite green — 170/170
tests (168 + 2 added from the review below), 120/120 manual-test-plan case IDs covered. WS-6 built
as a real per-store split, not the lighter ledger-only option originally proposed below — see
`WS6_PER_STORE_STOCK.md`.

**A high-effort code review after the live run found 10 real findings, all fixed:**
- **Sold-sale backfill gap**: migration 029 only backfilled `sale.store_id` for sales with a
  shift; a shift-less legacy sale (predates shift-required enforcement) kept `store_id null`,
  which every store-scoped "sold" subquery silently excludes (`null = $N` is never true) —
  understating sold quantity and overstating availability at whichever store was checked. Fixed:
  same lowest-id-store fallback `purchase_invoice` already uses.
- **Ad-hoc adjustments defaulted to a batch's original store, not where the adjustment is
  happening**: `stock-adjust-form.component.ts` never sent `storeid`, so `createQty` always fell
  back to `resolveHomeStoreId` — correct only until a batch is transferred, after which an
  adjustment made at the *destination* store silently posted against the *source* store's
  balance. Fixed: the form now sends the header's currently-selected store.
- **The cycle-count feature (WS-5) was entirely store-blind**: `getCountSnapshot` read the
  business-wide `product_items_view.balance` as "book quantity" regardless of where the count was
  being done, so a transferred-away portion of a batch showed up as a phantom "shortage" at the
  original store. Fixed properly, not just patched: `stock_count` gained a `store_id` column, the
  snapshot query now uses the same store-scoped formula as everything else in WS-6, and the
  resulting adjustments are attributed to the store the count was actually done at.
- **Bulk "clear to zero" (`/stock/adjust/qty/bulk`) had the identical business-wide blind spot**:
  it read `inventory_view.available` (global) and zeroed the *home* store only, so a batch split
  across stores by a transfer would go negative at one store while the other store's slice was
  never touched. Fixed: now computes and clears each store's actual slice separately.
- **`gst.service.createInvoiceFromPortalRow`** (the WS-5 GST "create invoice from portal row"
  action) saved a `PurchaseInvoice` directly, bypassing `PurchaseInvoiceService.create()` and its
  `storeid` resolution — would have 500'd on the new `NOT NULL` constraint the first time anyone
  used that button. Fixed with the same first-store fallback.
- **No way to actually open a shift with a deliberate `₹0` float from either UI**: the WS-9
  zero-float guard has an `allowZero` escape hatch, but neither the POS "My Shift" card nor the
  manager Shifts screen ever sent it — a legitimate zero-float open (rare, but the guard's own
  design assumes it's possible) had no path through the UI at all, just a permanent rejection.
  Fixed: both now show a confirm dialog ("Open with ₹0?") that retries with `allowZero: true`
  when the user accepts, using the existing `ConfirmationService` (same one delete-confirmations
  use) rather than a bespoke dialog.
- **Three copies of the same availability formula had drifted**: `stock.service.findByCriteria`
  filters `product_qtychange` on `active`/`archive` in its adjustment subquery; `sale.service.ts`'s
  oversell guard and `store-stock-transfer.service.ts`'s dispatch check both omitted that filter,
  so an archived adjustment row would count in a sale/transfer check but not on the stock screen.
  Fixed: both now match.
- **`assertUserAssignedToStore` failed open on a falsy `userid`**: defensive-only (every real HTTP
  call site has a JWT-verified id), but the guard is meant to deny, not allow, when it can't
  establish who's asking. Fixed to fail closed.
- Two minor items reviewed and intentionally left as-is, now documented rather than silent:
  transfer postings (`store-stock-transfer.service.ts`) deliberately bypass WS-3's value-threshold
  approval gate — a transfer already requires two separate permission-gated actions against a
  store-scoped balance check, which is its own control, not a gap; and `updateQtyAdjustment`/
  `createQty` take `@Body() body: any` with no dedicated DTO class, consistent with every other
  endpoint in this controller in a codebase with no global `ValidationPipe` — a new DTO here alone
  would enforce nothing. Added a cheap manual qty/itemid sanity check to both instead of a DTO.

New regression coverage for the two store-blind-spot fixes: `WS5-COUNT-STORE-SCOPED` and
`BULK-ZERO-STORE-SPLIT` in `stock.spec.ts`.

**Bugs the live run caught that static type-checking couldn't** (all fixed, see git history):
- `sql/ddl/006_dev_test_data.sql`'s `purchase_invoice` insert didn't set the new `store_id`
  column, which migration 029 made `NOT NULL` — bootstrap failed until fixed.
- `sale.module.ts` redeclares `StockService` with its own separate `TypeOrmModule.forFeature`
  list (same DI-duplication pattern as two prior `PurchaseInvoiceService`/`Vendor` incidents
  noted in [[purchasing-program]]) — missing the new `Setting`/`StockCount` repos, so the API
  failed to boot until they were added there too.
- `product_qtychange.reason` is `NOT NULL` at the DB level; WS-3's new reasoncode-only payloads
  (no `reason` sent) violated it. Fixed at the service layer (`stock.service.ts`) so any caller
  sending only `reasoncode` still satisfies the constraint - not just a qa/ fixture workaround.
- `qa/scripts/bootstrap-db.sh`'s hardcoded migration list stopped at `028` and needed `029-035`
  appended, or none of this workstream's schema would exist in a freshly bootstrapped stack.
- Two new qa/ spec files (`stock.spec.ts`'s `ownBatch` helper, `store-stock-transfer.spec.ts`)
  assumed `balance == qty` for a freshly purchased batch — wrong whenever the picked product's
  `pack` (randomized 1/10/15/30 by the seed) isn't 1. Fixed by pinning a fresh `pack:1` product
  for the adjustment tests and multiplying by the actual pack in the transfer tests.
- One pre-existing qa/ spec (`CASH-1`) opened a shift with `openingcash: 0` and no `allowZero` -
  exactly what WS-9's new zero-float guard is supposed to reject. Added `allowZero: true`.
**Covers:** everything raised in the 2026-09-05 store-module review **except cold-chain temperature
logging** (separate track, deferred). Builds on top of the shift/cash work already shipped —
see `CASHIER_SHIFT_CLOSE.md` and its "Not in scope" list, which WS-9 below picks back up.

## Ground truth that shaped this plan (superseded by WS-6 — see note)

- **Stock was global, not per-store, at scoping time.** `product`, `purchase_invoice_item`,
  `sale_item`, `product_qtychange` carried no `store_id` at all; only cash (`store_cash_account`,
  `store_shifts`) was store-scoped. This was the single biggest fact behind WS-1's design (a plain
  column, not per-store) and WS-6's original "ledger only" proposal below. **WS-6 shipped as a real
  per-store split instead** (`WS6_PER_STORE_STOCK.md`) — `purchase_invoice`, `sale`, and
  `product_qtychange` all carry `store_id` now. WS-1 stayed a plain column regardless (bin/rack
  location is a business-wide catalog attribute, not a per-store fact, even once stock itself
  became store-scoped).
- `store.location` already exists — but it's the **store's own address/city** (e.g. "Store
  location: MG Road"), not a shelf/bin location for a product. Anything for physical placement
  needs its own column name.
- `product_qtychange.reason` and the cash ledger's expense line are both free text — no controlled
  vocabulary, so nothing here is aggregable into a report today.
- `stock-adjust.component.ts`'s `edit(id)` is an empty stub — adjustments can only be deleted and
  re-entered, never corrected in place.

## Decisions (proposed — flag if you want something different)

| # | Question | Proposed decision | Why |
|---|---|---|---|
| 1 | Product location scope | **One bin/rack location per product, business-wide** (a plain column on `product`), not per-store. | Matches the existing pooled-stock model (#WS-1). Doing it per-store would require the WS-6 stock-split first — don't build that just to label shelves. |
| 2 | Stock transfer (WS-6) | **Introduce a lightweight per-store on-hand ledger** (`store_stock_transfer` rows only — not a full per-store rewrite of sale/purchase). Transfers move quantity between an implicit "unassigned/central" pool and stores; existing sale/purchase flows are untouched. | A full per-store stock model is a multi-week rewrite touching sales, purchases, and reporting. A transfer ledger gets you visible, auditable movement without that rewrite. Revisit a full split only if the business actually runs stock-separated multi-store, which nothing today confirms. |
| 3 | Adjustment reason taxonomy | Fixed enum: `DAMAGED`, `EXPIRED`, `RETURNED_TO_VENDOR`, `SHRINKAGE`, `CORRECTION`, `OTHER` (+ free-text comment for `OTHER`). | Small, covers pharmacy reality, still lets `comments` carry detail. |
| 4 | Expense categories | Fixed set to start: `RENT`, `ELECTRICITY`, `STAFF_ADVANCE`, `CLEANING`, `MAINTENANCE`, `MISC`, editable later via a lookup table if it turns out to need per-business customization. | Avoids building a settings screen before there's evidence it's needed; matches how the denomination set was handled (code constant, not configurable) in the shift work. |

Anything not listed here (copy, column order, exact icon) is normal implementation judgement.

---

## Workstreams

### WS-1 — Product bin/rack location  ·  S  ·  schema: 1 column  ·  **DONE**

Shipped: migration `030_product_bin_location.sql` (`product.bin_location varchar(40)`); DTO/entity;
product form gained a "Bin / Rack" field; `stock2.service.findAll` (backs the stock products list)
now selects it and the list shows it as a sortable, filterable "Location" column. QA:
`products.spec.ts` BIN-LOCATION (create/read/update round-trip). Not done (stretch, not requested):
printable bin labels.

**Was:** no location field anywhere on `product`. Stock lists (`stock-products.component`) had
no way to sort or filter by physical placement.

---

### WS-2 — Structured store expense tracking  ·  M  ·  schema: 1 table or 2 columns  ·  **DONE**

Shipped: migration `033_cash_expense_category.sql` (`store_cash_accounts.expense_category`,
`.receipt_path` — no `receipt_file_id` FK, since this codebase has no `files` table at all; the
files module is disk-storage only and every existing caller stores a plain path string, so this
follows that same convention rather than inventing a FK target). A structured expense **is** an
`EXPENSE`-category ledger row (per plan) — cash-variance math untouched. Fixed category taxonomy
(`RENT/ELECTRICITY/STAFF_ADVANCE/CLEANING/MAINTENANCE/MISC`, same fixed-in-code precedent as
denominations/reason codes) shown on the Cash screen's ledger form only when category = EXPENSE,
alongside an optional receipt file input (existing `FileUploadService`/`POST /files/upload`, path
stored on the row). New `GET /store-cash/expenses/summary` (defaults to the current calendar
month) backs an "Expenses by Category" table on the Cash screen. **Not done:** the "duplicate last
month's entries" recurring-expense convenience — de-scoped for time, no evidence yet it's needed
before a real business tries this for a month and asks for it.

**Was:** the cash ledger's `EXPENSE` category was free-text description + amount only — no
category, no payee, no receipt, no recurrence.

---

### WS-3 — Stock adjustment hardening  ·  M  ·  schema: 1 column  ·  **DONE**

Shipped: migration `031_stock_adjustment_reason_code.sql` (`product_qtychange.reason_code`, fixed
taxonomy `DAMAGED/EXPIRED/RETURNED_TO_VENDOR/SHRINKAGE/CORRECTION/OTHER` for user adjustments, plus
the system values WS-6's transfers already write — `reason` untouched, kept as free-text/display
compat, mirrored onto `reason_code` for all new rows). Approval gate: `stock.service.ts` derives a
per-batch unit value server-side (`coalesce(sale_price, mrp_cost, ptr_cost, 0)` — not trusted from
the client, several existing callers don't send `price` at all) and, when the caller doesn't force
a status, sets `PENDING` above a threshold (`Setting` key `stock_adjustment_approval_value_threshold`,
default 2000 — same pattern as the PO approval threshold) or `APPROVED` below it; an explicit
status (bulk-zero-out, the audit workflow) always wins, unchanged. Reused the existing audit
approve endpoint and added its missing `reject` counterpart (`PUT /stock/audit/:id/reject`) rather
than inventing a parallel approval flow — pending ad-hoc adjustments already showed up in the same
list as audit-sourced ones (`findAllQtyAdjust` has no status filter), so no new list/query was
needed. `edit(id)` implemented for real: new `PUT /stock/adjust/qty/:id`, wired to an edit dialog
on the Adjustments screen (in place of the empty stub) — updates the same row, doesn't
delete-and-recreate, and re-evaluates the approval threshold on the new qty. **Found a bug while
wiring this up:** the frontend's `updateQty()` was unconditionally sending `status: 'APPROVED'` on
every submission, which would have silently defeated the new threshold gate entirely — removed, so
the backend decides. QA: 4 new cases in `stock.spec.ts` (auto-approve under threshold, held above
threshold + approve applies it, reject leaves stock untouched, edit-in-place keeps the same row id).

**Was:** `product_qtychange.reason` was free text; `stock-adjust.component.ts.edit()` was an empty
stub (delete-and-recreate only); no approval gate regardless of adjustment size.

---

### WS-4 — Expiry lifecycle: alerts + return-to-vendor  ·  M  ·  no schema  ·  **DONE**

Shipped: new `GET /stock2/expiries/near-count` (`Stock2Service.getNearExpiryCount`) counts distinct
near-expiry batches via a fresh parameterized query against `product_items_view` (not the view's
own hardcoded-30-day `expired` flag), windowed by a `Setting` (`expiry_alert_days`, default 30 —
same fixed-with-override pattern as the PO/stock-adjustment thresholds, not the 30/60/90 tiers
originally sketched — a single configurable cutoff was simpler and covers the same need). Surfaced
as a tile on the Store landing page next to the WS-8 reorder tile, linking to the Expiry screen.
"Return to Vendor" reuses the existing `<app-stock-adjust-form>` (extended with a `defaultReason`
input) as a button per batch row on the expiry-items screen, posting a `RETURNED_TO_VENDOR`-coded
adjustment (WS-3) directly — no detour through the separate Adjust screen. **Found and fixed two
pre-existing bugs while in this code:** `findProductsByExpiries` built its SQL by string-interpolating
the `:month` route param directly (SQL injection) instead of parameterizing it; `stock-expiry-items
.component.ts`'s `closeAdjForm()` called `findByProduct(this.selectedItem.id)` — a method belonging
to a *different* screen's refresh logic, copy-pasted in, referencing a field (`.id`) this
component's rows don't even have (they use `.item_id`) — so the list never actually refreshed after
an adjustment; both fixed.

**Was:** `stock-expiry.component` only showed month buckets when you visited the screen — nothing
proactive. No action from the expiry list other than viewing it.

---

### WS-5 — Cycle count / physical stock take  ·  L  ·  schema: 2 tables  ·  **DONE**

Shipped, but simpler than sketched: **one** new table, not two. `stock_count` (migration
`035_stock_count.sql`) is just the header (status `IN_PROGRESS`/`COMPLETED`, category, started/
completed by+on); the count *lines* reuse the existing `product_qtychange` audit ledger (a new
`count_id` column links them) instead of a parallel `stock_count_item` table — one line per
variance, going through the exact same PENDING → manager-approve/reject flow already built for
WS-3, so count-driven adjustments show up in the same Adjustments screen rather than a second
review queue. **Deliberately did not** make count variances value-gated the way ad-hoc adjustments
are (WS-3's threshold) — `createStockAudit` (which counts now share) has always forced every line
to `PENDING` regardless of size, and two existing qa specs (STK-4, STK-5) assert exactly that; a
discovered count discrepancy getting a human look regardless of value is arguably the more correct
behaviour for an audit anyway, so this was kept as-is rather than "fixed" to match the ad-hoc gate.

Flow: `POST /stock/counts` (optional `category`) snapshots current balances (a fresh query, not the
one-off `stock_count_item` snapshot table originally sketched — a live re-query is simpler and
avoids a staleness question); staff edit "Counted Qty" per row in the new `/secure/store/stock/count`
screen; `POST /stock/counts/:id/submit` only creates adjustment lines for rows that actually
changed (untouched rows are silently skipped, not logged as zero-variance noise) and closes the
count. `GET /stock/counts` (history, with a line-count + total-qty-change rollup per count) and
`GET /stock/counts/:id` (detail, the actual lines) back the history view.

**Found and fixed one thing while building this:** confirmed the note in project memory that
`stock.service.createStockAudit`/`approveQtyAudit` and `GET/POST /stock/audit` already existed
server-side with **zero frontend** — this workstream is what finally gives that backend a screen,
via reuse rather than building a second parallel audit path.

**Not done** (scope decisions): `bin_location`-based sorting in the count-entry table (the plan's
"compounds nicely with WS-1" idea — the count screen doesn't filter/sort by it yet, though the data
is there); a dedicated shrinkage/variance-value trend report across counts over time (the history
list's roll-up numbers are the v1 version of this). QA: 3 new cases in `stock.spec.ts` (full
lifecycle incl. approval, a no-change line creates nothing, double-submit rejected).

---

### WS-6 — Inter-store stock transfer  ·  L (largest architectural change)  ·  schema: 1-2 tables  ·  **DONE**

Built as the real per-store split (decision #2 below was overridden at the user's request), not
the lighter ledger-only option this section originally scoped. Full design, what shipped, and what
was deliberately deferred: `WS6_PER_STORE_STOCK.md`.

**Today (superseded):** no per-store stock concept at all (see "Ground truth" above) — this workstream is the
one place in this doc that adds a genuinely new architectural piece rather than extending an
existing one.

**Build (per decision #2 — ledger, not a full per-store stock split):**
- `store_stock_transfer` (id, from_store_id nullable, to_store_id nullable, product_id, qty,
  status `PENDING`/`IN_TRANSIT`/`RECEIVED`, requested_by, received_by, transferred_at). Nullable
  from/to lets the first transfer *into* a store from the central/unassigned pool be recorded
  without needing a synthetic "warehouse" store row.
- A two-step flow: dispatch (creates the row, `PENDING`/`IN_TRANSIT`) → receive at the destination
  (confirms quantity actually arrived, flips to `RECEIVED`; a short-received transfer logs the
  difference rather than silently swallowing it).
- Stock lists gain a store filter once this exists, but the underlying "how much of product X do
  we have" query for sales/purchases stays business-wide unless a later decision splits it — this
  workstream deliberately does **not** change what quantity a sale is allowed to draw against.

**Effort:** L, and it's the one item here worth re-confirming before building — it's the only
workstream that adds new architecture rather than extending what's there. If in practice this
business only ever runs one physical store (the multi-store scaffolding exists but may not be
exercised yet), this workstream should probably be the last one picked up, or dropped until a
second store is actually live.

---

### WS-7 — Cashier open/close checklist  ·  S  ·  schema: 1 column or small table  ·  **DONE**

Shipped as planned: migration `034_shift_checklist.sql` adds `store_shifts.opening_checklist` /
`.closing_checklist` (jsonb, same shape as the denomination columns). Fixed checklist (4 items
each side — float/terminal/entrance/prior-deposit on open; drawer/entrance/lights/cash-secured on
close; nothing cold-chain-specific, per scope). Lives on the POS "My Shift" card
(`sale-shift-card.component`) — a checkbox list under the denomination grid in both open and close
modes; the confirm button is disabled until every item is ticked, then the checked keys are sent
alongside the denomination payload.

**One deliberate deviation from "block the close action" as originally written**: the backend only
validates the checklist **when the caller actually sends one** — omitting it entirely is not an
error. The POS card always sends a complete one (client-side gate), so in practice every till-side
open/close is checklisted; but the *existing* manager Shifts screen and the qa suite's ~15+
API-driven shift open/close calls never send one at all, and making it unconditionally mandatory
would have broken all of them. This mirrors how the denomination tally itself is optional-with-a-
fallback (`openingcash` as a plain number) rather than forced. QA: `WS7-CHECKLIST` (incomplete
rejected on both open and close, complete succeeds) and `WS7-CHECKLIST-OPTIONAL` (omitting it
entirely is unaffected) in `cash.spec.ts`.

---

### WS-8 — Store dashboard: low-stock / reorder tile  ·  S  ·  no schema  ·  **DONE**

Shipped: `store.component.ts` (the Store landing page) now calls the existing
`purchase-suggestions` endpoint on load and shows a small tile ("N products need reordering") next
to the page title whenever the count is above zero, linking to `/secure/purchases/orders`. No new
backend computation — reuses `findSuggestions()`'s existing `final_qty` field. No dedicated QA spec
(the count depends on volatile seed state); verified by code review + a clean frontend build.

**Was:** reorder suggestions exist (`purchase-intent` → the "Reorder" tab on
`/secure/purchases/orders`, per `PURCHASING_PAYABLES_GST_PROGRAM.md` WS-3) but nothing surfaced
them from the Store area itself — a Store Head had to know to go look at Purchases.

---

### WS-9 — Cash ledger + shift hardening  ·  M  ·  schema: none new (revisits deferred items)  ·  **DONE**

Shipped, all three: (1) opening a shift with a zero float now needs `allowZero: true`, same guard
shape as the existing empty-tally-on-close check. (2) `store.service.ts` gained
`assertUserAssignedToStore(userid, storeid)`, called from `createShift`, `closeShift`,
`assignShift` (which needed a `userid` param added — the controller wasn't passing one) and
`saveLedger` — Business Head bypasses (oversees the whole business), everyone else must have a
`user_stores` row for that specific store. **Note this is stricter than Store Head's usual
privileged-role bypass elsewhere** (`PermissionService.privilegedRoles` treats Store Head as
privileged for role-capability checks like "can open a shift at all" — that's still true here; this
check is a separate, additional store-*identity* scope on top of it, so a Store Head can still open
shifts, just only at a store they're actually assigned to). Migration `032_cash_deposit_reference.sql`
adds `store_cash_accounts.reference_no`, populated for `BANK_DEPOSIT` rows and shown in the Cash
screen's ledger table.

**Found a real test/production gap while wiring the store-scope check:** the existing
`SHIFT-STAFF` spec opened a shift as the shared `sales1` seed persona against a *freshly created,
unrelated* store — which the new check correctly rejects (sales1 is assigned only to store 1).
Fixed by having that test create its own store-scoped cashier instead of borrowing a shared
persona whose assignments other tests depend on; added `WS9-STORE-SCOPE` to assert the denial (and
that Business Head is unaffected) explicitly. QA: 3 new cases (store-scope denial + BH bypass,
zero-float rejection, deposit-reference round-trip).

**Was:** opening float could be `0` with no confirmation; shift open/close/assign and ledger writes
weren't scoped to the operator's assigned store; bank-deposit rows had no reconciliation reference.

---

## Actual build order (all shipped 2026-09-05)

WS-6 (per-store stock, built as the real split rather than the ledger option) → WS-1 (bin
location) + WS-8 (reorder tile) → WS-3 (adjustment hardening) → WS-4 (expiry alerts) + WS-2
(expense tracking) + WS-9 (cash/shift hardening) → WS-7 (checklist) → WS-5 (cycle count, reusing
WS-3's approve/reject and WS-1's groundwork). Migrations `029`–`035`.

## Not in scope

Cold-chain temperature logging (separate track, per 2026-09-05 discussion). Per-business
configurable denomination/expense-category/checklist sets (all fixed-in-code, matching the
existing denomination-set precedent, until there's evidence a single fixed set doesn't fit).
Barcode-scanner hardware integration for cycle counts (WS-5 ships with manual entry first).
