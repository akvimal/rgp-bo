# GST: the simple version, in phases

Status: **planned, not built** (2026-10-25). A deliberately small cut of `GST_END_TO_END.md`. That document is the long-term picture; this one is what to build now. Each phase is useful on its own, and you can stop after any of them.

> The Business Head owns the tax decisions (rates, thresholds, codes) and may check them with the business's auditor; nothing here is tax advice.

## Decisions taken (2026-10-25)

1. **Two kinds of business only:** **registered and filing**, or **not registered**. No "registered but not filing" state and no composition scheme for now.
2. **Who files:** the Business Head, through the **auditor**, who takes an **Excel of sales and returns**. The Business Head must also be able to log in to the GST portal and file himself, so the same figures and the portal file (Phase 4) must be available to him directly.
3. **No accountant in the loop.** Anything that needed an accountant's confirmation is the **Business Head's decision**, shown on screen ("provisional" or "you decide") and recorded with who chose it.
4. **A completed bill is changed by a new bill** (the old one is cancelled with its number kept, or a credit note is issued, and a new bill is made), not by editing it.
5. **When a rate falls, old stock passes the saving on by default** (Phase 1). The Business Head can switch a change, or one product, to keep-the-price after a confirmation; the choice is recorded.
6. **Build order:** Phases 1 to 3 now; Phase 4 (portal file) after.

## Built (phases 1 to 3), 2026-10-25

Migrations 106 (rate changes, HSN), 107 (registration, invoice numbers, credit notes) and 108 (month close). The screens are under **GST** in the menu (Business Head): Registration, Sales register, Monthly summary, Rate changes, HSN codes.

- **Phase 1:** `gst_rate_change` and `gst_sale_rate(product, batch GST, date)`; the till, the stock list, the price screens, the outage price list and the MRP ceiling all use it; the old 5% cap is one dated change from 22 Sep 2025. Preview with both price choices (pass the saving on is the default; keeping the price needs a confirmation and is recorded on the change; **repricing itself is done on the price screens, the preview gives the figures**). Alert before a change takes effect. Report after it. Missing-HSN list, category defaults (provisional until confirmed), and proposals from purchase lines. **New purchase lines now store the HSN the vendor printed** (before, the purchase line only copied the product's own HSN, so there was little to propose from).
- **Phase 2:** registration (not registered, or registered and filing from a go-live date); a valid GSTIN is needed; tax invoices numbered `PFX/26-27/000123` in a series per financial year, taken inside the bill's own transaction; buyer GSTIN and place of supply (CGST+SGST or IGST); an issued tax invoice cannot have its lines, total, status or buyer changed (return the goods and make a new bill); a settled return of a tax invoice makes a credit note at the invoice's rate; the printed bill is a Tax Invoice only when it has a number. A business that is not registered gives cash memos and sees its sales against the registration limit.
- **Phase 3:** the sales register (tax invoices rate by rate, credit notes, cash memos, returns of cash memos); the HSN summary (own, provisional, unknown); the monthly summary (output tax less the input credit from the reconciliation, payable or carry forward); the auditor's Excel (sales and returns only, and the full records pack); closing a month with the filing date and ARN, which locks it against new tax invoices and keeps the HSN summary and the summary as they stood; reopening needs a reason; an alert from a few days before the 11th.
- **Known limits:** the "keep the price" choice does not reprice by itself; credit notes are dated the day the return is settled; the usual filing dates shown (11th and 20th) are fixed text, not settings; the registration-limit warning is on the screen only (no alert); bills saved in the same instant can still collide (an existing limit of the bill-number counter: the second is refused and saved again, no number is lost); the HSN-wise figures need the products' HSN to be filled in (on the prod copy, 1,934 of 1,963 active products have none).

## What we reuse (already built)

- Purchase invoices with the GST split, supplier GSTIN and period, and the GSTR-2A/2B reconciliation with ITC claimable, on hold and carried forward.
- `business.gstin` and `state_code`, `vendor.gstn`, `product.hsn_code` and `tax_pcnt`, and `purchase_item.hsn` (the vendor's HSN on each purchase line; the invoice reader already extracts it).
- Every bill line stores the rate it was billed at; the till bills at the batch rate capped by `pricing/sale_gst_cap_pct` (migration 096).
- The `gst` module switch, the period lock, the alerts engine, Excel export, the price-setting dialog and pricing governance.

## Products with no HSN (applies to every phase)

Not knowing a product's HSN must never stop a sale or a rate change. HSN matters at **filing** (the HSN summary of the return), not at the counter.

1. **HSN is optional on a product.** A blank HSN never blocks billing, purchasing or a rate change. Only a quiet note appears for the store head, not at the till.
2. **The rate does not depend on the HSN.** A rate change can be scoped by **category or product** as well as by HSN prefix (Phase 1), so a product with no HSN still gets the new rate. The preview lists the products a change **does not cover because their HSN is blank**, and offers to include them by category or product.
3. **Fill the gaps from what we already have:**
   - **From purchases:** when a purchase line carries an HSN (typed or read from the vendor's invoice) and the product has none, the system **proposes** it. One click accepts it, and nothing is changed without that click.
   - **By category:** a category can carry a **default HSN prefix** (the pharmacy pack seeds common ones for medicines, dressings, supplements and devices; every one marked provisional until the Business Head confirms it). A product without its own HSN uses its category's default, shown as **provisional**.
   - **By hand:** a **Missing HSN** list shows the products sold or in stock without an HSN, ordered by sales value, with the code typed in the row and a bulk "set for this category" action.
4. **At month close** (Phase 3) the HSN summary uses the product's own HSN, else the category default marked provisional, else a line "HSN not known" with its value. The pre-check lists these so the Business Head decides before filing; the choice is recorded. The HSN summary is stored when the month is closed, so a later correction does not alter a closed month.
5. **Digits needed** depend on turnover (4 or 6 digits; *accountant to confirm*), a setting under GST; a code with fewer digits than needed is listed as incomplete.
6. **A business not on GST** is never asked for an HSN; the field stays optional and the lists do not appear.
7. Every HSN change is audited (who, when, from, to).

## Phase 1: rates that change on a date (fixes the 12% to 5% case)

**Why first.** It is the real problem you described, and it needs no new documents or returns.

**What the user gets**
- Settings > GST > **Rate changes**: a short list of changes, each with what it covers (all products, a category, an HSN prefix, or one product), the **new rate or a maximum rate**, the **effective date** and a note (the notification).
- A bill dated on or after the date is billed at the new rate. Older bills never change. Old stock bought at 12% sells at 5% from the date; the purchase invoice keeps its 12% for credit and cost.
- **Preview before saving:** the products and stock affected, the products **not covered (blank HSN)**, the price today, and the price after under two choices: **keep the MRP** or **pass the saving on** (old taxable value plus the new tax). The choice is shown and recorded; applying new prices uses the existing price screens, one product or one set at a time.
- An **alert** a few days before the date to the Business Head and store heads.
- A **rate-change report** after the date: stock by batch with old and new rate, sales since the date by rate.
- The **Missing HSN** list and the purchase-based proposals (above).

**How it is built (small)**
- One table `gst_rate_change` (business, scope type and value, `set` or `cap`, rate, effective date, note, created by).
- One function `gst_sale_rate(product, date)`: the most specific matching change in force on the date wins (product, then HSN prefix, then category, then all); with none, today's rule (batch rate with the cap) applies. So nothing existing breaks.
- Today's global cap becomes one dated row (cap 5% from 22 Sep 2025) and the setting is retired.
- The till, the MRP guard and the stock query ask the function with the bill date; edits keep the bill's own date.
- A bill in a locked period is not re-rated.
- A category default HSN column and the "propose from purchase" query.

**Not in this phase:** the master of every HSN code in the schedule, bulk import of notifications, per-state variation.

**Size:** small to medium. **Tests:** rate by date and by specificity, a product with blank HSN covered by a category change, the example numbers (MRP 112 at 12% and at 5%), an old bill unchanged, the cap migrated, the HSN proposal never applied without a click.

## Phase 2: GST on or off, and a proper bill when it is on

**Why.** Some businesses do not file yet; those that do need a bill that carries what a return needs.

**What the user gets**
- Settings > GST > **Registration**: one of **Not registered** or **Registered and filing**, with the GSTIN (checked for format and check digit), state and a **go-live date**.
- **Not on GST:** bills are cash memos with no tax split; no GST screens appear; purchases carry no credit. A small **turnover against the registration limit** figure warns before registration is needed (the limit is a setting to confirm).
- **Switching on later:** a go-live date; bills from that date are tax invoices; nothing before it is rewritten.
- When registered: **tax invoice numbers in a financial-year series** with no gaps; the buyer's **GSTIN and state** can be captured (B2B); an **inter-state bill** shows IGST instead of CGST and SGST.
- **A sale return produces a credit note** (own number, the original invoice and rate), instead of only a return record.

**How it is built**
- A registration row on the business (type, GSTIN, state, go-live) and a store link; the existing bill number counter gets the series format.
- Place of supply on the bill (the store's state by default, a delivery state when set); IGST fields on the bill line.
- A credit note record linked to the return settlement.

**Not in this phase:** several GSTINs in a business, composition tax calculation, bill of supply variants, advances, reverse charge.

**Size:** medium. **Tests:** numbering under concurrent billing, intra and inter-state split, go-live date respected, credit note at the original rate.

## Phase 3: the monthly sales register and a simple summary

**Why.** This is what the auditor needs to file, and what the Business Head needs to file himself. The main output is an **Excel of sales and returns**.

**What the user gets**
- GST > **Sales register**: invoices and credit notes for a month, with buyer, taxable value, CGST, SGST, IGST and total; filters; Excel download.
- **HSN summary** for the month (quantity, taxable value and tax by HSN and rate), following the HSN rules above, with the missing and provisional codes listed.
- **Monthly summary page**: output tax by rate, minus the ITC claimable from the reconciliation that already exists, giving tax payable or credit carried forward, with the documents behind each figure one click away.
- **Records pack for the accountant:** one Excel with the sales register, purchase register, HSN summary, the summary page and the reconciliation, with a cover sheet.
- **Month closed** marker with the date the accountant filed and the ARN typed in; the existing period lock then also covers sales for that month, and the HSN summary is stored.
- An alert for the monthly filing dates.

**How it is built:** queries over the posted bill lines and credit notes, one Excel builder (the report one already used), a filing-status row per month with the stored HSN summary.

**Not in this phase:** portal JSON files, GSTR-3B interest and late fee, ledgers, challans.

**Size:** medium. **Tests:** register total equals the sales report total, HSN summary equals register, the summary equals the register and reconciliation figures, a closed month unchanged by a later HSN edit.

## Phase 4 (optional): the portal files

Only if the accountant wants to upload from the app instead of re-keying.
- **GSTR-1 JSON** (and Excel) from the register, with a short check list before download (missing HSN, bad GSTIN, gaps in numbering) and the portal's error report read back to the invoices.
- **Fuller 2B reading:** credit and debit notes and amended invoices, and the Excel download, with a totals check. Today only the B2B section of the JSON is read.
- Read the **filed GSTR-1 and 3B** summaries to compare with the register.

**Size:** medium. Test with a few real, anonymised files from the business's portal.

## What waits (kept in the long document)

Rate master for every HSN code, reverse charge, blocked-credit and 180-day reversals, ledgers and challans, interest and late fee, e-invoice and e-way bill, several GSTINs and inter-state stock transfers, the portal connection, annual return.

## Order and effort

| Phase | Gives | Depends on | Effort |
|---|---|---|---|
| 1 Rate changes (and missing-HSN handling) | the 12% to 5% case, correct bill rate by date, gaps in HSN found and filled | nothing | S to M |
| 2 GST on/off and bill | non-filers handled, tax invoice, IGST, credit notes | 1 helps | M |
| 3 Register and summary | accountant can file from our numbers | 2 | M |
| 4 Portal files | upload and fuller reconciliation | 3 | M |

Phases 1 to 3 together are the smallest complete cycle: a correct bill, a register, and a monthly figure for the accountant.
