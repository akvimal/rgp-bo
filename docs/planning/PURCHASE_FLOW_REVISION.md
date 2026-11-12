# Purchase flow revision (planned 2026-11-12, not built)

Source: owner's observations on the purchase module. Analysis only; no code changed.

## Decisions (owner, 2026-11-12)

1. An item the vendor sends that is not on the PO **is received**, flagged "Not on order". It is not blocked.
2. **Invoices without a PO are allowed** (direct purchase).
3. Any change between PO and invoice is a discrepancy: no tolerance.
4. Invoice qty above the ordered qty is **flagged**, not blocked.
5. The existing MRP / rate analysis stays on and unchanged: "Vs last", price reasons and tolerance, price impact, "No price yet".

## Work items

### A. Small, independent
| # | Change | Where |
|---|---|---|
| A1 | `neededby` defaults to today + 2 days on a new request (also on the reset after save); editing keeps the saved date | `requests/components/purchase-request.component.ts` (initial value, reset in the new-request opener) |
| A2 | Dialog header "New Purchase Request" when adding, "Edit Purchase Request" when editing | `purchase-request.component.html` p-dialog header |
| A3 | On picking an existing product, show a stock summary strip: in stock, sold last 30 days, last bought (date, rate), reorder level, on order, last vendor, link to purchase history | request dialog; small summary endpoint, or reuse data behind `app-product-stock-history` |
| A4 | Purchase history icon beside the product on each PO line, opening `app-product-stock-history` as Reorder does | `purchase-order-view.component.html` lines table |
| A5 | "New product needs a sale price": product name and a "Set price" button open a small price dialog (suggestion prefilled, editable). Keep "Set these prices" for the batch. Same link on the "No price yet" badge | `invoices/components/invoice-items.component.html` ~278 and ~189 |

### B. PO "Add items" dialog
`purchase-order-view.component.html:105`: replace the single dropdown with a multi-select table (wider, ~60rem).

Columns: select, product, qty, stock, type (reorder / customer), priority, needed by, last rate, history icon.
Vendor-matched requests first. Requests naming another vendor are badged. A search box. Footer "N of M selected  [Cancel] [Add N items]".

### C. Invoice against a PO (main change)

**Header**
- First control: **Against a purchase order** (list of approved POs) or **No purchase order**. One must be chosen.
- With a PO: vendor is read-only, taken from the PO. Without: vendor is chosen as today.
- Invoice copy block: attach only, or attach and let the system read it. Reuse a copy already uploaded (and scanned) instead of asking again.

**Lines (PO invoice)**
- Saving the header creates the lines from the PO automatically (qty ordered, PO rate). The "Import PO Items" button goes away.
- Each PO line can be removed from this invoice (vendor did not supply it). The PO line stays open for a later delivery.
- Adding an item not on the PO stays available, but the line is marked **Not on order** and asks for a reason. The new-product dialog stays reachable from here and from direct purchases.
- Scan present: scanned values overwrite the PO values on matched lines. Scanned lines with no PO match arrive as **Not on order** lines (received, flagged), not dropped.

**Flags per line (exact comparison to the PO line)**
Qty (over-supplied shown as its own flag), MRP, rate, discount, GST %, pack. Show `PO value -> invoice value`. Flags are shown in the lines table and summarised above it ("5 lines differ from the order").
Existing checks (Vs last, price reason needed, price impact) keep running on top.

**No purchase order**
Behaves as today: free add, no PO comparison, new-product dialog available.

**Setting**
None for now: anyone who can add invoices may choose "No purchase order". A "PO required" setting can be added later if wanted.

### D. Invoice copy handling
- One control with states: none (choose file), attached not read (offer "Read this copy"), attached and read (name, "Replace copy", "Scan again").
- Replace during or after a scan: warn that edited lines are replaced; offer keep edits vs re-scan.
- Backend must keep the original file and link it to the latest scan run. **To check before building:** how `documentpath` and scan runs are stored (`invoice-form.component.ts` `loadScan`, `service.scan`).

## Order of work
1. A1-A5 (independent, low risk)
2. B
3. C + D together (they share the scan-versus-PO comparison)

## Tests to add
PO invoice creates lines; removing a line keeps the PO line open; off-PO line needs reason; each flag kind (including over-supply); scan overwrites matched lines and routes unmatched ones to Not on order; direct purchase unchanged; copy reuse and replace; price-change checks still fire on PO invoices.

## Decided later (2026-11-12)
- One PO can be invoiced in parts: each new invoice pre-fills the **remaining** qty (ordered minus already invoiced), and the PO closes when fully invoiced.
- No "PO required" setting; "No purchase order" open to all who can add invoices.
- Flagged lines show in review only; they never block completing the invoice.

## Build status (2026-11-12)
Built, uncommitted, not run in a browser, migration 182 not applied anywhere:
- A1-A5, B (see above).
- C: migration 182 (po_expect, off_po, off_po_reason on purchase_invoice_item); invoice created against a PO brings the PO's remaining lines in automatically; scan verify updates the PO's line (keeps its expectation) or creates a line marked off_po; a hand-added line for a product not on the PO is marked off_po; items page shows per-line differences (qty, over-supply, rate, MRP, disc %, GST %) and a note; header asks PO or "No purchase order" first, vendor read-only from the PO.
- D: "read the copy for me" tick, "Read this copy / Read it again" on an attached copy, replacing a copy keeps checked lines.
Not built: a reason prompt for off-order lines (a default reason is stored); removing a PO line from an invoice has no new control (the existing line delete is used); QA specs for the new flow (existing specs updated to choose "No purchase order").
