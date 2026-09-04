# Purchase Order flow revamp + demand-driven reordering

**Date:** 2026-09-04
**Branch:** feature/shift-cash-phase1
**Status:** Planning — not started (this is item 6 of the UX enhancement batch; items 1–5, 7–10 are done)

---

## Why

Two problems, one area:

1. **The PO screen is not intuitive.** `/secure/purchases/orders` shows a `p-table` of orders; clicking a
   PO renders its detail into a `<router-outlet>` **below the grid** (`purchase-order.component.html:53`).
   It reads as "nothing happened" — no master/detail affordance, the detail is off-screen on a laptop.
   Creating a PO is a near-empty dialog (vendor + date + comments); line items are added afterwards, one
   at a time, from *separate* screens (`purchase-request`, `purchase-suggestion`).

2. **Reordering is manual guesswork.** A buyer has to already know what's running low. The data to answer
   "what should I order right now" exists but is buried.

## What already exists (reuse, don't rebuild)

`api-v2/src/modules/app/purchases/purchase.service.ts`

- **`findSuggestions(query)`** — `GET /purchase-suggestions`. A CTE that, per product:
  - `recent_sales` — units sold over the last `days` (default 30), COMPLETE sales only
  - `stock_by_product` — available = received − sold + approved adjustments
  - `avg_daily_sales`, `stock_days_left`
  - `trend_qty` = `ceil(targetDays × avg_daily_sales − available)` clamped at 0 (default target 21 days)
  - `adhoc_qty` — sum of open/reviewed `purchase_request` rows
  - `final_qty` = `trend_qty + adhoc_qty`
  - `preferred_vendor` — most recent vendor that supplied the product
  - `reasons[]` — Low Stock / Customer Request / Urgent / Fast Moving
- **`createOrdersFromSuggestions(dto)`** — `POST /purchase-suggestions`. Takes selected rows, groups by
  vendor, drafts one PO per vendor with the line items and a source summary.
- Frontend `purchase-suggestion.component.ts` already calls both — it just lives on a secondary route.

## Target design

### Phase 6a — UX revamp (no new analytics)

1. **Make Suggestions the PO landing view.** Tabs on `/secure/purchases/orders`:
   - **Reorder** (default) — the suggestions table: product, avg/day, days of cover, on-hand, suggested
     qty (editable), preferred vendor (editable), reason chips. Controls for `days` / `targetDays`.
     Multi-select + "Draft POs" (calls `createOrdersFromSuggestions`). Grouped-by-vendor preview before commit.
   - **Orders** — the existing list, but as proper **master/detail**: selecting a row opens the detail in
     a right-hand panel (or a dedicated `/orders/:id` route), not below the grid. Detail keeps the current
     actions (Add request, Proceed, Approve, Reject, Download).
2. **Fold `purchase-request` and `purchase-suggestion` into this screen** so there is one place for
   "what to buy". Keep the routes as redirects for now.
3. Consistent with the rest of this batch: `p-table` with sort/paginator, `grid-actions`, confirm on
   destructive actions, no raw id columns.

**Effort:** L (~1–2 days). Backend: none. Frontend: new tabbed container + move 2 components + master/detail panel.

### Phase 6b — smarter demand signal ("AI/analytics")

The current `trend_qty` is a flat `avg × target − stock`. Upgrades, roughly in value order:

| Signal | How | Data source |
|---|---|---|
| **Trend / momentum** | compare last 7-day vs prior 7-day velocity; weight the reorder up when accelerating | `sale_item` + `sale.bill_date` |
| **Seasonality / day-of-week** | 90-day profile per product; don't over-order on a slow-day snapshot | same |
| **Stock-out risk** | flag when `stock_days_left < vendor_lead_time`; lead time from PO `createdon → invoice_date` history | `purchase_order`, `purchase_invoice` |
| **Expiry-aware** | discount on-hand that expires before it can sell through | `purchase_invoice_item.exp_date` |
| **Vendor consolidation** | nudge borderline items onto a vendor that already has a draft to hit MOQ / save freight | draft POs |
| **"Current situation" summary** | an LLM paragraph over the ranked suggestions: *"Antibiotic demand up 38% WoW; 4 fast movers below 1 week cover; ₹X across 3 vendors."* | the suggestion rows themselves |

The LLM summary is the only piece needing a new dependency — an API key + provider choice (Claude via the
Anthropic API is the natural fit) and a backend service that takes the suggestion JSON and returns prose.
Everything else is more SQL in `findSuggestions` plus new columns the Reorder table can show and sort on.

**Effort:** L–XL, and needs product decisions:
- target service level (days of cover) — global, per category, or per product?
- who can draft vs approve suggestion-generated POs?
- LLM provider + budget, and whether the summary is on-demand or cached per day.

## Open questions for the team

1. Do you want 6a shipped on this branch, or as its own branch/PR?
2. For 6b, is the LLM "situation summary" in scope now, or start with the deterministic signals only?
3. Should the Reorder view be store-scoped (per the header store switcher) or business-wide?

## Not in scope

GRN / invoice matching, vendor payment terms, budget approval workflow — separate tracks.
