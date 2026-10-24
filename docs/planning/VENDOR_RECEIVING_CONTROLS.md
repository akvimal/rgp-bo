# Vendor receiving controls

Status: planned 2026-10-24. Phase A (migration 091) and Phase B (migration 092) built 2026-10-24, uncommitted. API-tested; screens compile but have not been viewed in a browser.

## Concerns (from the store)

1. The vendor sends goods with a delivery challan, and the invoice follows later.
2. The printed invoice that comes with the goods can have typos in batch, expiry and quantity.
3. The vendor raises the price of an item against the last purchase without telling us.
4. Delivered goods can include empty strips or poor-quality product.

Common cause: receiving is one step (enter invoice, complete, stock goes in). Nothing records what physically arrived,
what was billed, or whether the two agree.

## Decisions (2026-10-24)

| # | Decision |
|---|---|
| 1 | Goods on a challan are **sellable immediately**, flagged as awaiting invoice. |
| 2 | **Store Head** receives and approves exceptions. |
| 3 | Price tolerance: within ±0.5% passes; above 0.5% needs a reason; above 5% needs approval. |
| 4 | Minimum remaining shelf life at receiving: **6 months**. Below that the line is blocked unless overridden. |
| 5 | Cost of challan stock = **the challan's own rate** (challans carry rates). |
| 6 | The invoice number may be unknown at receiving and **added or changed later** in the system. |

## What exists

- `purchase_invoice` status NEW -> COMPLETE; completing generates the GRN (`generate_grn`) and puts stock in.
- PO import pre-fills each line from the product's last invoiced rate, batch and MRP (`purchase-invoice.service.ts`,
  `importOrderItems`). The prior rate is fetched but never compared.
- `vendor_issue` (migration 064) covers INVOICE_FIX, DEFECTIVE, SHORT_SUPPLY, WRONG_ITEM with a credit-note / refund /
  replacement / corrected-invoice lifecycle and goods-returned-to-vendor. Raised by hand, after the fact.
- Expiry is required unless the product is flagged "No expiry date". Duplicate invoice number per vendor is rejected
  (`assertNotDuplicate`).
- `purchase_invoice.invoice_no` is `NOT NULL`, unique with `vendor_id`.

## Design

### Challan before invoice (concern 1, decisions 1, 5, 6)

Reuse `purchase_invoice` as the receipt instead of adding a second entity, so stock, GRN, payables and GST keep one
code path.

- New columns on `purchase_invoice` (migration 092): `challan_no`, `challan_date`, `challan_path` (photo). "Awaiting invoice" is derived (`invoice_no is null`), not stored.
- `invoice_no` becomes nullable. The unique key (invoice_no, vendor_id) still prevents duplicates; Postgres allows many
  NULLs. While `invoice_pending`, screens show the challan number as the reference.
- Lines are costed at the challan rate and marked provisional until the invoice is matched.
- When the invoice arrives, the user opens the receipt and fills the invoice number, date and tax fields. If rates
  differ, the price rules in Phase A apply and costs are trued up. `assertNotDuplicate` already runs on update.
- One invoice covering several challans: `challan_no` accepts a list in v1. A proper link table only if this is common.
- "Received, not yet invoiced" list: value and age per vendor.
- Payables ignore a receipt until the invoice number is present (vendor payments are bank-only).
- GST reconciliation ignores pending receipts until they have an invoice number.

### Typos and shortages (concern 2, decision 4)

- Receiving screen shows expected lines next to **actual** quantity, batch and expiry keyed from the physical pack.
- Per-line variance chips: short/over quantity, batch differs, expiry differs, rate differs, free quantity differs.
  A line with a variance cannot complete silently; the user accepts it with a reason or raises a vendor issue.
- Accepting a variance creates a `vendor_issue` pre-filled with `billed_value` and `correct_value`.
- Stock carries the physical batch and expiry; the invoice line keeps what was billed. Both are stored.
- Expiry rules: block under 6 months remaining (override needs Store Head); flag expiry earlier than existing stock of
  the same product; flag a batch already in stock with a different expiry.
- Optional per-vendor blind count (expected quantity hidden).
- Later: AI second read of the invoice photo against what was keyed (`invoice-extract/` exists).

### Price increases (concern 3, decision 3)

- Each line compares against the PO rate and the vendor's last invoiced rate for that product.
- Inline marker, e.g. `+4.2% vs last (Rs 118.00 on 12 Aug)`.
- Within 0.5% passes. Above that a reason is required: price revised, new batch, scheme ended, vendor error.
  Above 5% completion needs approval (Store Head / Business Head through the approvals mechanism).
- Vendor price history per product; margin-floor warning when the new rate pushes margin too low (suggests, never
  changes sale price); vendor price-creep report (weighted increase over 90 days).
- Later: per-vendor agreed-rate list with validity dates; a rate above it is an overbilling and can raise an issue.

### Poor quality (concern 4)

- Configurable inspection checklist per receipt (pattern: shift checklists): seals, outer pack, cold chain,
  sample strips opened.
- Per-line disposition: Accept / Quarantine / Reject. Rejected quantity never enters sellable stock and raises a
  DEFECTIVE vendor issue with photos. Quarantine sits in a hold bin.
- "Report defect" on any stock batch (counter, customer complaint) links to receipt, vendor and invoice.
- Vendor scorecard: price variances, short supply, invoice errors, defects, days to resolve.
- Open vendor credits are netted at pay-run time; disputed invoices use the existing invoice hold.

## Phases

| Phase | Scope | Concern |
|---|---|---|
| A | Price compare at invoice-line entry, tolerance, reason codes, approval above 5%, price history | 3 |
| B | Challan fields, nullable invoice number, provisional cost, "received not invoiced" list, payables/GST guards | 1 |
| C | Variance chips, expiry rules, auto-raise vendor issue | 2 |
| D | Inspection, disposition and quarantine, scorecard, credit netting | 4 |
| E | Agreed-rate list, AI second read | 2, 3 |

## Risks and open points

- Provisional costing makes margin on a few days of sales slightly off until the invoice is matched. Accepted.
- Making `invoice_no` nullable touches views in `sql/ddl/003_views.sql` and the invoice list; check each for null
  handling in Phase B.
- `stock.module.ts` redeclares `PurchaseInvoiceService` with its own repository list; any new repository must be added
  in both modules.

## Phase B as built

- `invoice_no` nullable; a receipt needs an invoice number or a challan number (CHECK + service message). Same challan number from the
  same vendor twice is refused (partial unique index), as is a repeated invoice number.
- Awaiting-invoice receipts: stock in, completed normally; not in Outstanding/Payables; payment refused; `gst_period` empty so every GST
  query ignores them. Entering the invoice number later (invoice edit page, allowed on a received receipt) sets the GST month from the
  invoice date. An invoice number cannot be removed once a payment or GST match exists.
- Invoice list: "Awaiting invoice" chip (count, value, oldest days), view, "Add invoice no." action. Items page: challan header, banner, payment hidden.
- Not built: re-costing lines after the invoice arrives (rate differences go through a vendor issue); several challans on one invoice
  (v1: one challan per receipt, so such an invoice needs a receipt per challan or a note); the challan total is entered in the invoice-total field.
