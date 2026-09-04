# Purchasing, Payables & GST Reconciliation — implementation program

**Date:** 2026-09-04
**Branch:** feature/shift-cash-phase1 (or a dedicated `feature/purchasing-gst`)
**Status:** Decisions locked (2026-09-04) — **WS-1, WS-2, WS-3 (phase 6a), WS-4 done**; WS-3 phase 6b and WS-6 deferred (need an LLM); WS-5 not started.
**Covers:** the PO/invoice/payment review findings + **GST inward-supply (GSTR-2A/2B) reconciliation** + AI invoice extraction.
**Companion doc:** `PURCHASE_ORDER_REVAMP.md` (PO UX + demand analytics — referenced, not repeated here).

## Decisions (locked 2026-09-04)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | GSTIN scope | **One GSTIN per business** (v1). Multi-state deferred. | Matches the single-state-chain assumption already in the schema (one `business` row, no state field yet). Revisit if a business registers in a second state. |
| 2 | 2B import | **Manual JSON/Excel upload only** (v1). GSP API deferred. | Needs no vendor subscription or API credentials to ship; the portal JSON download is free and works today. |
| 3 | Who claims ITC | **Business-level, always** — no per-store apportionment. | Follows from #1; stores don't have their own GST registration. |
| 4 | Finance role | **Fold into Business Head** for v1; no new role yet. | Avoids a permission-matrix change before there's a real second finance user; `gst.*` actions still exist as a distinct resource so a Finance role can be split out later without a data migration. |
| 5 | Till-cash vendor payments | **No — vendor payments are always business-level (bank), never from till cash.** | Keeps WS-2 schema simple (no `store_cash_accounts` link). If a store genuinely pays a vendor from the drawer, that's already recordable as a manual `EXPENSE` ledger entry today; it just isn't auto-linked to the vendor payment record. |
| 6 | AI provider + cost ceiling | **Anthropic API (Claude)**, opt-in per business, monthly cost cap set via a `Setting` (default a conservative cap), extraction pauses when the period's cap is hit rather than hard-failing mid-job. | Consistent with the model family already used for this session; a soft cap avoids surprise bills without silently dropping in-flight work. |
| 7 | Matcher tolerances | **±₹1 absolute, ±1% relative** on value/date fuzzy matches, as proposed. | Standard rounding/paise-difference tolerance; tune after the first real reconciliation. |
| 8 | Historical scope | **Backfill the WS-4 data-model fields for all existing invoices** (so reporting is consistent), but **reconciliation itself starts from the first open period going forward** — no retroactive matching of already-closed periods. | Reconciling old, already-filed periods has no ITC value and would just generate noise; the data backfill is still worth doing once, cheaply, in the migration. |

Anything not listed here (exact UI copy, table column order, etc.) is left to normal implementation judgement.

---

## 1. Current state

| Area | Today |
|---|---|
| PO create | Dialog = vendor + expected date + comments. Line items added later from a **separate** Requests screen, linked by `orderid`. |
| PO list | `findAllOrders` returns `[order, vendor.name]` only — no value, no line count. |
| PO approval | `evaluateOrderApproval` — per-product flags, qty threshold, total-value threshold, with reasons. Works well. |
| Demand | `findSuggestions` — velocity, days of cover, preferred vendor, open requests → `final_qty`. Buried on a `/suggestions` tab, raw table. |
| GRN / invoice | Create invoice → add items (manual / "Import PO Items") → select → Verify → Complete → raises stock. `invoice-items.component.html` is full of dead markup. |
| Invoice list | **Two components** — `invoices.component` (dead, ID column) and `invoice-list.component` (live, Paid/Balance/Payment cols + Outstanding tab). FE `findAll()` treats the response as an array but the API returns `{data,total,page,limit}` → list is effectively broken / capped at 50, no paging. |
| Payment | `vendor-payment.service.create` saves **whatever `amount` is passed** — no `≤ balance`, no "invoice must be COMPLETE", no `> 0`. FE amount field is `<input type="text">`, pre-filled to the full balance. No edit/reversal in the UI. |
| Payment status | `getDerivedPaymentStatus` — Unpaid / Part Paid / Paid / Overdue / On Hold. Good. |
| Due date | `duedate = dto.duedate ?? invoicedate` → no explicit due date = **due today**, Overdue tomorrow. No vendor payment terms. |
| GST | Nothing structured. `vendor.gstn` (single field), `product.hsn_code`, `tax_pcnt` on product/sale_item/purchase_invoice_item. `sql/gst.sql` = ad-hoc output-GST queries, run by hand, intra-state only (CGST = SGST = tax/2), no IGST. **No buyer GSTIN anywhere.** No taxable-value / tax-split columns. No inward-supply / 2A / 2B / ITC anything. |
| Comms | Payment "communication status / channel" (WhatsApp/SMS/Email) captured but nothing sends. |

---

## 2. Workstreams

### WS-1 — Cleanup & correctness  ·  ~3 days  ·  no schema (or trivial)  ·  **DONE**

Small, independent, unblocks the rest. Do first.

Shipped: migration `026` (`vendor.payment_terms_days`, `vendor_payment.status`/`reverses_id`/`batch_ref`);
`invoice-items.component` rebuilt; `vendor-payment.service` validates amount `> 0`, `≤ balance`, and
invoice `status === 'COMPLETE'`; a `reverse()` endpoint + UI action instead of in-place edit;
`invoice-payment.component`'s `ngOnChanges` was also fixed to actually fetch payment history once the
invoice id arrives (it never had before — a pre-existing bug, payments always rendered empty); invoice
due date defaults to `invoicedate + vendor.paymenttermsdays`; invoice list now unwraps
`{data,total,page,limit}` via `[lazy]` paging instead of calling `.map` on it; dead `invoices.component`
/ `purchases.component` deleted; `/secure/store/intent` (unreachable, no nav link) redirects to the
canonical `/secure/purchases/requests`; `createOrder` validates `vendorid`. Verified: qa/ suite 132/132
across 3 clean runs; the QA seed's confirm-invoice step was also fixed from a stray `status:'VERIFIED'`
to the real `'COMPLETE'` terminal status (found because the new payment guard caught it).

- **Rebuild `invoice-items.component`** — kill the dead markup, blank `<th>`s, inline `[ngStyle]`, `<h4>` icon wrappers; clean header/body/footer; `p-datatable-sm`; `grid-actions`.
- **Payment validation** (backend `vendor-payment.service.create` + FE):
  - reject `amount ≤ 0`, `amount > balance` (with a small tolerance), and payment on an invoice not `COMPLETE`;
  - FE: `<input type="number">`, don't pre-fill the full balance (or pre-fill but require an explicit change / confirm for the full amount);
  - re-throw `HttpException` from any wrapping catch.
- **Payment edit / reversal** — expose `updatePayment`; add a "reverse" that writes a negative offsetting payment with a reason (keeps the audit trail) rather than deleting.
- **Due date + terms** — `vendor.payment_terms_days` (default 0); on invoice create, `duedate = invoicedate + terms` when not given. Invoice form shows the computed due date.
- **Invoice list contract fix** — FE reads `resp.data`; wire the `p-table` to server-side `[lazy]` paging (`page`/`limit`), or at minimum stop capping at 50.
- **Delete the dead `invoices.component`** and its route-less wiring.
- **`createOrder` validation** — reject a missing/invalid `vendorid`.
- **Consolidate** `purchase-request` + `store/intent` (`purchase-intent.component`) — they are two UIs over the same `purchase_request` table. Keep one, redirect the other.

### WS-2 — Vendor payables view  ·  ~3 days  ·  minor schema  ·  **DONE**

Shipped: `GET /purchases/payables` (per-vendor rollup: invoice count, total outstanding, total
overdue, on-hold count, oldest due date, 0-30/31-60/61-90/90+ ageing buckets, built on top of the
existing `findOutstanding()`); `POST /vendorpayments/batch` (pay run — one or more `{invoiceid,
amount}` allocations for a single vendor, written inside one `SERIALIZABLE` transaction under a
shared `batch_ref`, sharing `vendor-payment.service`'s existing amount/status/On-Hold validation so
an invalid line rolls back the whole batch); new `/secure/purchases/payables` screen (KPI band +
per-vendor ageing table + a "Pay" dialog listing that vendor's outstanding invoices oldest-first,
with an "Auto-fill" button that allocates a given available amount oldest-first capped at each
invoice's balance) with a "Payables" nav link. No new schema needed — `vendor_payment.status` /
`reverses_id` / `batch_ref` already existed from WS-1's migration `026`. Till-cash question (item 5
above) resolved as part of the locked decisions: vendor payments stay business-level bank only, no
`paid_from` column. Verified: qa/ suite 136/136 across 3 clean runs on a fresh bootstrap+reseed
(includes new `qa/specs/payables.spec.ts`: nav reachability, rollup-totals-match-manual-sum, a
two-invoice split pay run sharing one `batch_ref`, and atomic rollback of a batch containing one
invalid line); `coverage-check` still 120/120 (the new spec covers a feature outside the original
manual test plan, by design); manual browser pass confirmed the KPI band, ageing table, and
Auto-fill allocation all matched the API's numbers before/after submitting a real pay run.

- **Vendor payables rollup** — new screen / tab: per vendor → open invoices, total outstanding, total overdue, oldest due date, ageing buckets (0-30 / 31-60 / 61-90 / 90+).
- **"Pay run"** — select a vendor (or several), see the outstanding invoices oldest-first, tick the ones to pay, record one payment batch that splits across invoices (respecting each balance, skipping `On Hold`).
- Schema: `vendor_payment.status` (`RECORDED` / `REVERSED`), `vendor_payment.reverses_id` (nullable FK), `vendor_payment.batch_ref` (nullable, groups a pay run).
- **Decision needed:** are vendor payments ever paid from **till cash** (→ needs a `store_cash_accounts` entry, category `VENDOR_PAYMENT`), or always business-level bank? If mixed, add `vendor_payment.paid_from` (`BANK` / `TILL`) + a store link, and write a ledger row for `TILL`.

### WS-3 — PO revamp  ·  ~1.5 weeks  ·  per `PURCHASE_ORDER_REVAMP.md`  ·  **phase 6a DONE**

Phase 6a (UX revamp) shipped: Reorder (suggestions) is now the default landing tab on
`/secure/purchases/orders`, with Orders and Requests folded in as tabs on the same screen instead of
three separate nav links; opening a PO shows its detail in a side-by-side master/detail panel instead
of below the grid; the order list gained Lines + Est. Value columns; the PO detail gained a
**fulfilment view** (Ordered / Invoiced / Received qty per line, the latter two from
`purchase_invoice_item.request_id`). Phase 6b (trend/seasonality/stock-out-risk signals and an LLM
"situation summary") is **deferred alongside WS-6** — the situation-summary piece needs an LLM and the
deterministic signals were judged not worth their own pass separate from that work. Verified: qa/
suite 136/136 across 3 clean runs; coverage-check 120/120; only PO-1's UI assertion needed updating
(switches to the Orders tab first, since Reorder is now the default).

Master/detail (not "below the grid"), suggestions-first "Reorder" tab, PO estimated-value + line count in the list, a **fulfilment view** on the PO (qty ordered vs invoiced vs received, per line), and the demand-signal upgrades in that doc's §6b. Independent of the GST track.

### WS-4 — GST data model  ·  ~4 days  ·  schema + backfill  ·  **DONE**

Shipped: migration `027` (business gstin/legal_name/state_code/address/pincode;
purchase_invoice + purchase_invoice_item GST columns per the tables below, with a one-time backfill
from vendor.gstn / product.hsn_code / invoice_date, assuming intra-state 50/50 CGST-SGST for existing
rows). `purchase-invoice.service` now derives supplier GSTIN / place of supply / supply type on every
new invoice (from the vendor's GSTIN vs the business's own state code), splits each line's tax into
taxable value + CGST/SGST or IGST, and sums lines back to the header (incl. round-off vs the invoice
total) on every item add/edit/remove and once the header total itself is set at GRN completion. The
GRN screen (`invoice-items.component`) gained a GST Details card - editable fields while the invoice
is still NEW, plus a read-only tax breakdown with an OK/Mismatch check. `business.service` now accepts
the new GST fields via `PUT /businesses/:id`; a business-settings UI for them is a follow-up (the
existing businesses screen has unrelated in-flight edits from the user's own session, left untouched).
Verified: qa/ suite 141/141 across 3 clean runs (new `qa/specs/gst-data-model.spec.ts`, GST-1..4 + a
GRN-screen UI check); coverage-check 120/120; manual browser pass on a real seeded invoice.

Foundation for WS-5. Also feeds better GST reporting on the sales side later.

**`business`** — add `gstin`, `legal_name`, `state_code`, `address`, `pincode`. (One GSTIN per business assumed — see open decisions.)

**`purchase_invoice`** — add:
| Column | Notes |
|---|---|
| `supplier_gstin` | snapshot from vendor at entry (vendor GSTIN can change) |
| `place_of_supply` | state code |
| `supply_type` | `INTRA` / `INTER` (derived from buyer vs supplier state) |
| `invoice_type` | `REGULAR` / `SEZ` / `IMPORT` / `DEEMED_EXPORT` (default REGULAR) |
| `reverse_charge` | boolean |
| `taxable_value` | Σ of line taxable values |
| `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount` | |
| `round_off` | invoice value − (taxable + taxes) |
| `itc_eligibility` | `INPUTS` / `CAPITAL_GOODS` / `INELIGIBLE` (default INPUTS) |
| `itc_reversal_amount` | manual, e.g. for expired/damaged stock |
| `gst_recon_status` | `UNRECONCILED` / `MATCHED` / `MISMATCH` / `MISSING_IN_2B` / `ACCEPTED` / `EXCLUDED` (default UNRECONCILED) |
| `gst_period` | the return period the invoice belongs to (`YYYY-MM`), from invoice date |

**`purchase_invoice_item`** — add `hsn` (snapshot from product), `taxable_value`, `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount`. Derive on GRN Complete.

**Backfill (migration):**
- `supplier_gstin` = current `vendor.gstn`; `place_of_supply` / `supply_type` = intra-state (single-state assumption); `hsn` per item = `product.hsn_code`.
- Per line: `taxable_value = round(total / (1 + tax_pcnt/100), 2)`, tax = `total − taxable_value`, split 50/50 CGST/SGST for INTRA. Sum to the invoice header.
- `gst_period` from `invoice_date`. `gst_recon_status = UNRECONCILED`.

**GRN screen (WS-1 rebuild):** capture `supplier_gstin` (prefilled), `place_of_supply`, `reverse_charge`, `itc_eligibility`; compute and show the CGST/SGST/IGST breakdown and the invoice-value vs (taxable + tax + round-off) check.

### WS-5 — GST inward-supply reconciliation  ·  ~2 weeks  ·  new module

**New tables**

`gst_return_period` — one row per `YYYY-MM` per business:
`business_id, period, status (OPEN / RECONCILED / FILED / LOCKED), gstr2b_imported_at, gstr2a_imported_at, itc_available, itc_claimed, itc_on_hold, itc_reversed, notes`.

`gst_inward_supply` — staged rows from a GSTR-2A/2B import:
`business_id, period, source (2A / 2B), supplier_gstin, supplier_name, invoice_no, invoice_date, invoice_value, taxable_value, cgst, sgst, igst, cess, place_of_supply, reverse_charge, itc_availability (from 2B), filing_status, filing_period, import_batch, raw jsonb, matched_invoice_id (nullable)`.

`gst_reconciliation` — the match link and its verdict:
`business_id, period, purchase_invoice_id (nullable), inward_supply_id (nullable), match_type (EXACT / PROBABLE / MANUAL), status (MATCHED / MISMATCH / MISSING_IN_2B / MISSING_IN_BOOKS / ACCEPTED / DISPUTED / EXCLUDED / CARRIED_FORWARD), variances jsonb ({field, books, portal}), resolution_note, resolved_by, resolved_at`.

**Import**
- Manual upload of the **GSTR-2B JSON** (portal download) — parse `docdata.b2b[].inv[]` into `gst_inward_supply`. Also accept the **2B Excel** and the **2A JSON/Excel**.
- (Later) GSP API pull — needs a GSP subscription + API credentials; out of scope for v1.
- Idempotent per `(business, period, source)` — re-import replaces the batch.

**Matching engine** (run after import, and on demand):
1. **Exact** — same normalised `supplier_gstin` + normalised `invoice_no` + `invoice_date` + `invoice_value` within ₹1 → `MATCHED`.
2. **Probable** — GSTIN matches AND (invoice_no fuzzy-equal OR date ±3 days) AND value within 1% → `PROBABLE`, needs a human "accept".
3. **Value/tax mismatch** — GSTIN + invoice_no match but value or tax differs → `MISMATCH` with `variances`.
4. **In books, not in portal** → `MISSING_IN_2B`.
5. **In portal, not in books** → `MISSING_IN_BOOKS` (offer "create draft invoice from this row").
6. Rows a user resolved keep their manual verdict on re-run.

**Reconciliation workspace UI** (`/secure/purchases/gst`)
- Period selector + "Import 2B" / "Import 2A" / "Run match".
- Summary tiles: **Matched** (count, ITC ₹) · **Mismatch** · **Missing in 2B** (ITC at risk ₹) · **Missing in books** · **ITC claimable this period** · **ITC on hold / carried forward**.
- Worklist grouped by status; each row: books side vs portal side, variance chips, actions — *Accept match*, *Mark disputed (with vendor follow-up note)*, *Exclude*, *Carry forward to next period*, *Create invoice from portal row*.
- Vendor drill-down: "Vendor X — 3 invoices not in 2B, ₹Y ITC blocked, oldest 40 days" + a "chase vendor" action (uses the existing comms fields).
- **ITC ledger** per period: available (from matched + accepted), claimed, on hold, reversed, net; a "Lock period" that snapshots it and flips invoices' `gst_recon_status` to final.
- Carry-forward: `MISSING_IN_2B` rows roll into next period's worklist automatically until matched or written off.

**Permissions** — new `gst` resource (`read`, `import`, `reconcile`, `lock`). A new **Finance** role, or fold into Business Head — see open decisions.

**Reports** — GSTR-2B vs books summary (PDF/Excel), ITC register, vendor non-compliance list.

### WS-6 — AI invoice extraction  ·  ~1.5 weeks + provider setup  ·  makes WS-4/WS-5 usable

The bottleneck: you can't reconcile invoices you haven't entered, and hand-keying a 15-line GRN takes ~5 min each.

- **Upload** a vendor invoice (PDF or photo) on the GRN screen → an extraction job.
- **Extract** via the Anthropic API (vision + structured output): header (`supplier_gstin`, invoice no/date, place of supply, reverse charge, taxable value, CGST/SGST/IGST, invoice value) + lines (`description, hsn, batch, exp, mfr, qty, free, rate, mrp, disc%, tax%`).
- **Catalog match** — extracted description → `product` by fuzzy name + composition, with a confidence score; low-confidence rows flagged for a human pick.
- **Review UI** — original doc on the left, extracted draft on the right; accept / fix per line; unmatched products get a picker or a "create product" shortcut.
- On accept → creates the `purchase_invoice` + items (status `NEW`), GST header prefilled, then the normal Verify → Complete flow.
- The extracted GST header also **pre-matches** against any imported 2B row for that supplier+period.
- **Infra** — `ai_extraction_job` table (`status`, `source_file`, `model`, `tokens`, `cost`, `result jsonb`, `error`); a queue (jobs run async); per-business monthly cost ceiling + a kill switch; store the uploaded file via the existing `files` module.
- **Provider decision** — Anthropic API (Claude); needs an API key in config, cost monitoring, and a prompt/output-schema owned in the repo.

---

## 3. Sequencing

```
WS-1  ─────────────►                          (independent, first)
WS-4          ──────────►                      (needs nothing; blocks WS-5)
WS-6                  ──────────►              (needs WS-4 fields; makes WS-5 usable)
WS-5                          ──────────────►  (needs WS-4; better after WS-6)
WS-2     ───────►                              (independent, any time)
WS-3            ─────────────────►             (independent, any time — see PO doc)
```

**Recommended order:** WS-1 → WS-4 → WS-6 → WS-5, with WS-2 and WS-3 slotted in parallel by whoever is free.

## 4. Consolidated migrations

| # | Contents |
|---|---|
| 026 | `vendor.payment_terms_days`; `vendor_payment.status` / `reverses_id` / `batch_ref` / `paid_from` (+ store link) |
| 027 | GST columns on `business` / `purchase_invoice` / `purchase_invoice_item` + backfill (WS-4) |
| 028 | `gst_return_period`, `gst_inward_supply`, `gst_reconciliation` (WS-5) |
| 029 | `gst` permission resource + Finance role rows (`005_seed` + patch, like `023`/`025`) |
| 030 | `ai_extraction_job` (WS-6) |

Each with a rollback. Add all to `qa/scripts/bootstrap-db.sh`.

## 5. Effort roll-up (one developer)

| WS | Effort |
|---|---|
| WS-1 cleanup | ~3 d |
| WS-2 payables | ~3 d |
| WS-3 PO revamp | ~1.5 wk |
| WS-4 GST data model | ~4 d |
| WS-5 GST reconciliation | ~2 wk |
| WS-6 AI extraction | ~1.5 wk + provider setup |
| **Total** | **~7–8 weeks**, sequenced |

## 6. Decisions

See the table at the top of this doc — all eight are locked as of 2026-09-04.

## 7. Not in scope

Output-GST (GSTR-1 / GSTR-3B) filing, e-invoicing / IRN, e-way bills, TDS/TCS, the GST portal's own filing UI. This program is **inward-supply reconciliation for ITC** only; output-GST reporting is a separate track that reuses WS-4's tax-split columns.
