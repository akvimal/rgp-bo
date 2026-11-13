# GST monthly sales report

Status: designed 2026-11-13. Phase 1 is built in the same change (see "Built"); phases 2 to 4 are not.

## Why

The GST area already has a sales register (tax invoices rate by rate, credit notes, cash memos, cash-memo returns, cancelled bills and gaps), the
HSN summary and a monthly summary (output tax less input credit). It has no single sheet in the order a return is keyed, no tie-out between the
tax figures and the bills' totals, no split of the 0% supplies into nil-rated, exempt and non-GST, and nothing for expired stock and the other
adjustments that touch the return.

## Decisions (2026-11-13)

1. The new report **replaces the output table** on the Monthly summary (the summary keeps the input credit, the payable line, the HSN summary and
   closing the month). It is not a separate tab.
2. **Nil-rated, exempt or non-GST is set once by the CA and kept as a default** per category, with an override on a product. Default for any 0% line
   with nothing set is nil-rated.
3. The treatments in "Questions for the CA" below are listed in this document so they can be sent as they are.

## The report (one sheet per month, in filing order)

| Block | Content |
|---|---|
| A. Outward supplies by rate | One row per rate sold (0, 5, 18, and any other in the rate master): taxable value, CGST, SGST, IGST, tax, total. |
| B. Returns | Credit notes by rate, in the same columns, with the cash-memo returns total, then the **net** per rate. |
| C. B2B and B2C | Sales to buyers with a GSTIN, and consumer sales, each in-state or out-of-state, by rate. |
| D. Nil-rated, exempt, non-GST | The 0% supplies split by kind, in-state or out-of-state, B2B or B2C. |
| E. Tie-out | Bills' total = taxable + tax + round-off. The difference is shown as round-off and must be small; a larger difference is flagged. |
| F. Documents | Invoice numbers from and to, how many issued, how many cancelled, gaps. |

The net tax of block B always equals the net output used for the payable line (a spec holds the two together).

## Supply kind

- `gst_supply_kind_default`: one row per category (case-insensitive): `NIL_RATED`, `EXEMPT` or `NON_GST`, with who confirmed it and when.
- `product.gst_supply_kind`: optional override on a product.
- It matters only for a line billed at 0%. A line with a rate above 0 is taxable whatever is stored.
- Order: the product's own, then its category's default, then nil-rated.
- The Monthly summary lists the categories that have 0% sales in the month, with their kind and whether it is confirmed, and lets the Business Head
  set it (the CA's answer, entered once).

## Questions for the CA

These are the app's present treatments, for the CA to confirm or correct. Nothing here is tax advice.

1. **Nil-rated, exempt or non-GST.** Which of our product categories at 0% are nil-rated, which exempt and which outside GST? (Set once per category.)
2. **Round-off.** Bills are rounded once to the nearest rupee. Should the round-off be reported inside the taxable value of the sale, or left out as an
   adjustment? The report shows it separately.
3. **Expired or damaged stock written off.** Is input credit on that stock to be reversed, in which month, and at what value (purchase cost, with the
   GST paid on it)? The report will show the GST paid on purchase by rate.
4. **Expired stock returned to the vendor.** Is the vendor's credit note handled as a reduction of input credit in the month of the note?
5. **Free samples, gifts and own use.** When goods go out without a sale, are they a supply to report, and at what value?
6. **Stock moved between stores.** The stores share one GSTIN today. Confirm this is not a supply. If any store has its own GSTIN, it needs an invoice.
7. **Delivery charges.** Is the delivery charge a taxable supply, at what rate, and is it reported with the goods or on its own?
8. **Customer advances.** Confirm that an advance for goods (customer orders) has no GST until the sale.
9. **Credit notes.** A credit note is dated the day the return is settled, at the invoice's own rate. Confirm this is right for the return period.

## Built in phase 1

- Migration 199: `gst_supply_kind_default` and `product.gst_supply_kind`.
- `gst-sales-report.ts` (pure, with a spec): the blocks above from bills, credit notes and cash memos.
- `GET gst/sales-report?month=&store=` (frozen at month close, as the HSN summary is), `GET gst/sales-report/xlsx`, and category kinds
  (`GET/PUT gst/supply-kinds`).
- The Monthly summary shows the report in place of the old output table; the auditor's pack opens with it.

## Built in phase 2 (2026-11-13): adjustments, read-only

`GET gst/adjustments?month=&store=` (`gst-adjustments.ts`, pure, with a spec), shown on the Monthly summary under the report as "Adjustments to
review", and as an Adjustments sheet in the report's Excel and the auditor's pack. All by GST rate, as value before GST and the GST paid on it:

- **Stock written off:** confirmed out-passes (expired, near expiry, damaged) by the day the goods left, out-passes recorded as disposed earlier, and
  old write-offs a person confirmed as expiry. Goods returned to the vendor on an out-pass are kept apart, so nothing is counted twice.
- **Vendor returns made in the month** (not yet credited, or credited on an invoice).
- **Vendor credits applied** on purchase invoices in the month.
- The GST paid on written-off stock is rolled up by rate as the figure a reversal of input credit would start from. The app only gathers the figures;
  whether and when anything is reversed is the CA's decision (questions 3 and 4 above). Nothing here changes a return, a sale or stock.
- Not covered: delivery charges.

## Built in phase 3 (2026-11-13): stock-out reasons

- Three new reasons on the Adjust stock screen, removal only: **Free sample given** (`SAMPLE`), **Gift or promotion** (`GIFT`) and **Own use (the shop or its staff)**
  (`OWN_USE`). Not losses, so they are not flagged as discards. Each needs a few words on who it went to and why; the API refuses one without
  (on create, bulk create and an edit that changes the quantity or reason). The existing approval value threshold applies as for any adjustment.
- The Monthly summary's Adjustments section lists the approved ones by reason and GST rate: value at cost before GST, the GST at the purchase rate,
  and the value at MRP beside it, with the same blocks in the Excel. Whether goods given out are a supply, and at which value, is the CA's decision
  (question 5); the report only gathers the figures. Nothing about stock or a return changes.

## Sales behind each rate (2026-11-13)

- Every rate in the Supplies table of the Monthly summary (and its Total) is a link that opens the sales lines at that rate for the month: bill, date, product,
  batch, quantity, line total, discount, taxable value, CGST, SGST and IGST, with a search box and the totals. `GET gst/sales-items?month=&rate=` returns them
  (the screen lists the first 2,000).
- Each line carries its share of the bill's discount and tax, allocated in proportion to its gross with the last line of a rate taking the paisa left, so the
  lines of a rate add up exactly to the report's row for it (`gst-sales-items.ts`, with a spec; QA test GRG-10).
- The report's Excel and the auditor's pack carry a **Sales items** sheet with every line of the month, tax invoices and cash memos (a memo has no tax split).

## Phases still to do

4. **Portal-ready export** of the return tables, once the CA has checked the layout.
