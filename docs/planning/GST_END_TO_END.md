# GST end to end: design

Status: **designed, not built** (2026-10-25). Starts from what exists (purchase invoice capture and GSTR-2A/2B reconciliation) and adds the rest of the cycle: rates that change over time, correct tax on every sale, the outward register, the returns, input credit control, and the monthly routine.

Read with `CATALOGUE_KINDS_AND_CATEGORIES.md` (services, SAC, returns switch) and `BUSINESS_TYPES_AND_PACKS.md`.

> **Legal accuracy.** GST rules, thresholds, due dates and form tables change by notification. This design therefore keeps every such value as **data with an effective date** (section 4), never in code, and every rule below that quotes a number or a date is marked *verify* and must be confirmed by the business's chartered accountant before it is loaded. The design describes how the system carries the rules, not tax advice.

---

## 1. What exists today

| Area | State |
|---|---|
| Business | `business.gstin`, `state_code` (derived from the GSTIN's first two digits), legal name, address. A business with no GSTIN is billed as "Cash Bill" today; there is no explicit not-on-GST state and no go-live switch |
| Vendor | `gstn` on the vendor master |
| Product | one `tax_pcnt`, `hsn_code`; no link from HSN to a rate; no dates |
| Purchase invoice and lines | supplier GSTIN, GST period (`YYYY-MM`), HSN, taxable value, CGST/SGST/IGST per line and per invoice (IGST when the supplier's state differs from the business's) |
| Reconciliation | import of GSTR-2A/2B rows, matcher, worklist (accept, dispute, exclude, carry forward, create invoice from a portal row), period lock, ITC claimable / on hold / carried forward, readiness, vendor risk |
| Sales | every bill line stores the rate billed (`tax_pcnt`); the till bills `sale_gst(batch tax)`, the batch's rate capped by setting `pricing/sale_gst_cap_pct` (5 now, migration 096); bill print shows a CGST/SGST table and "Tax Invoice" when the business has a GSTIN, else "Cash Bill" |
| Module | `gst` (needs purchasing) |

**Gaps this design closes:** no dated rate master; the cap is one global maximum; no per-line state or IGST on sales; no invoice number series that meets GST rules; no credit note for sales returns; no outward register, HSN summary, GSTR-1 or GSTR-3B data; no reverse charge, blocked credit or ITC reversal; no liability or credit ledger; no payment and late-fee tracking; no compliance calendar; no e-invoice or e-way bill; no filed-status record.

---

## 2. Principles

1. **Rate follows the supply date.** Output tax uses the rate in force on the bill date. Input credit uses the rate on the vendor's invoice. The two are kept apart and never assumed equal for the same product.
2. **A posted document never changes.** A bill, invoice or credit note, once issued, is corrected only by another document (credit note, debit note, amendment). The books explain themselves.
3. **Rules are data.** Rates, thresholds, due dates, HSN digit requirements and ITC time limits live in tables with effective dates and a notification reference.
4. **One source for each figure.** The outward register, the HSN summary, the GSTR-1 file and the GSTR-3B workings are all produced from the same posted lines, and a reconciliation proves they agree.
5. **The app prepares; people file.** First version produces the return data and an upload file for the GST portal and records that it was filed. Direct portal connection comes later through a GST suvidha provider (GSP).
6. **Period lock.** Once a return is filed for a period, documents of that period are frozen; later changes go to a later period.
7. **A business that is not GST-registered, is on composition, or is registered but not yet filing, gets the right documents** (bill of supply, no tax shown, or tax kept in the books only) and no filing screens, not a hidden failure.
8. **GST is switched on with a go-live date**, never retroactively: nothing before the date is rewritten, and the first return starts from it.

---

## 3. The registration profile

A business is not just "has a GSTIN". It has a **tax profile** that decides which documents and returns apply.

| Field | Values | Effect |
|---|---|---|
| Registration | `none`, `regular`, `composition` (plus a **filing state**, below) | none: bill of supply or cash memo, no tax charged, no credit, no GST screens; regular: tax invoices, GSTR-1/3B; composition: bill of supply, flat-rate tax, quarterly statement |
| Return frequency | `monthly`, `quarterly` (QRMP) | decides GSTR-1 / IFF and 3B due dates and the payment scheme |
| GSTIN per state | one or more, each with state code and the stores it covers | stores in different states are different registrations |
| Annual turnover band | stored with the financial year | drives HSN digits, e-invoice applicability and QRMP eligibility (*verify the bands*) |
| Effective dates | from / to | a change of scheme is dated, not overwritten |

### 3.1 A business that is not on GST yet

Many small businesses start below the registration threshold or have not registered. The design treats this as a first-class mode, not an error.

| State | Meaning | System behaviour |
|---|---|---|
| `none` | not registered, not required to be | no GST fields on the bill, the bill is a **cash memo / bill of supply**, the `gst` module is off by default (no GST menu, no GSTIN or HSN prompts, no rate master use), prices are the sale prices with no tax split, purchases are recorded at their full cost (any tax paid to a vendor is part of cost, no credit) |
| `none` + **threshold watch** | below the registration limit, approaching it | the Business Head sees the **running turnover for the financial year** against the limit (the amount and the state-wise limits are parameters; *verify*), with an alert at set percentages, so registration is not missed (registration is required once the limit is crossed, and for some supplies regardless) |
| `registered_not_filing` | has a GSTIN but is not yet issuing tax invoices or filing (for example registered but awaiting the first filing, or a position agreed with the CA) | the GSTIN and state are held; bills stay cash memos **until the go-live date**; purchase invoices can already be captured with their GST and the reconciliation can be run (credit is only recorded as a **potential** ITC, not claimed) |
| `regular` / `composition` | filing | as in the rest of this design |

**Switching on later (the go-live step).** A wizard under Settings > GST:
1. Enter the GSTIN (checksum checked), state, scheme, return frequency and the **go-live date** (the effective date of the registration row).
2. The system shows what changes from that date: bills become tax invoices with a series, the rate master is used, credit notes replace return slips, returns are prepared.
3. **Nothing before the go-live date is touched.** Earlier bills stay as cash memos and are outside GSTR-1. The opening position (stock on hand and any **ITC on opening stock** the CA decides to claim, *verify*) is entered as an **opening ITC ledger entry** with the reason.
4. The `gst` module is switched on and the filing calendar starts from the go-live month.
5. Everything is audited; the switch is undone only by a dated change of registration (for example cancellation), never by deleting documents.

**What a non-GST business must never see:** GSTIN, HSN, "Tax Invoice", tax columns, tax on the bill print, reconciliation, GST alerts. **What it may still use:** the product HSN field (optional), the rate master read-only (so the data is ready when it registers), and the price list (prices stay as they are).

**Purchases from a non-GST vendor, or by a non-GST business,** carry no credit; this is the same `ineligible` path as a bill of supply (section 7.1) and needs no special case in the ITC ledger.

**Where it lives:** `gst_registration` (business, GSTIN, state code, legal name, trade name, scheme, return frequency, from, to) and `store.gst_registration_id`. A single-store business has one row and never sees the rest.

**GSTIN validation:** format (15 characters, state code, PAN, entity number, `Z`, check character) and the **check digit** (base-36 mod 36 algorithm), run when a GSTIN is entered for the business, a vendor or a customer. The state code must be a known state.

---

## 4. Master data

### 4.1 Tax rate master (the core of the rate-change scenario)

`gst_rate` rows:

| Column | Meaning |
|---|---|
| `code_type` | `HSN` or `SAC` |
| `code` | full code or a prefix (2, 4, 6, 8 digits); the longest matching prefix wins |
| `description` | as notified |
| `rate_pcnt` | 0, 0.25, 3, 5, 12, 18, 28, or as notified |
| `cess_pcnt`, `cess_per_unit` | where it applies |
| `supply_class` | `taxable`, `exempt`, `nil_rated`, `non_gst`, `zero_rated` |
| `rcm` | reverse charge applies (by category, see 7.3) |
| `effective_from`, `effective_to` | the dates the rate applies; overlapping rows for one code are refused |
| `notification` | the notification number and date, free text |
| `source` | `seed`, `manual`, `bulk` |

Rules:
- A product has an HSN or SAC (from its category, overridable). Its rate is **looked up** by `rate_for(code, date)`. The product no longer owns the rate, except an **override** (below).
- **Product override** (`product.tax_override_pcnt`, with its own from/to) for the case where the business's reading differs from the master; it is shown on a report so it is not forgotten.
- Seeded from the notified schedule for the business type (a pharmacy gets chapter 30 and the usual health lines), and kept current by the business or by the provider's update.
- **Compliance parameters** (`gst_parameter`: key, value, effective_from) hold thresholds and dates: B2C-large invoice limit, e-invoice turnover limit, e-way bill value limit, HSN digit requirement by turnover, ITC time limit, due dates by return and frequency, late-fee and interest rates.

### 4.2 Parties

- **Customer:** optional GSTIN and state, validated. A customer with a GSTIN makes the sale **B2B**. Without it, the sale is **B2C** and the place of supply is the store's state (for goods sold over the counter).
- **Vendor:** GSTIN, state, registration type (regular, composition, unregistered), and whether the vendor's supplies are under reverse charge when unregistered.
- **Place of supply:** derived (goods at the counter: the store's state; delivered goods: the delivery state; services: per the rules for the service) and stored on the document, because it decides CGST+SGST versus IGST.

### 4.3 Products

- `hsn_sac` (from the category, overridable), `tax_override_pcnt` (rare), `supply_class` default from the rate row, `gst_applicable` (false for a non-GST item), and for a catalogue **service or plan** the SAC code.
- A change of HSN on a product is audited and dated; a posted document keeps the code it used.

---

## 5. Rate resolution

One function, used everywhere a rate is needed (till, edit, return, report, price list, purchase check):

```
taxFor(product, date, supply) -> { rate, cess, class, source: master | override }
```

- **Sale:** `date` is the bill date. A bill edited later keeps its bill date, so it keeps its rate unless the edit changes the date (which is refused after the period is locked).
- **Sale return:** the credit note uses the **original bill's** rate.
- **Purchase:** the rate is what the **vendor's invoice states**; it is recorded as given. The system compares it with `taxFor(product, invoiceDate)` and **flags** a difference (a vendor billing the old rate after a change, or a keying error) without blocking.
- **Batch rate** (`purchase_item.tax_pcnt`) stays on the batch for cost, margin and ITC only. It never decides the sale rate.
- **Replaces** `sale_gst_cap_pct`: after the rate master is live the cap is retired (kept off by default; a legacy business can keep it on until its master is loaded).

---

## 6. Outward supplies (sales)

### 6.1 Documents

| Document | When | Notes |
|---|---|---|
| **Tax invoice** | registered (regular) seller, taxable supply | mandatory fields: seller name, address, GSTIN; invoice number and date; buyer name, address, GSTIN where B2B; HSN or SAC; description; quantity and unit; value; discount; taxable value; rate and amount of CGST/SGST/IGST/cess; place of supply and state code; reverse charge flag; signature or digital signature |
| **Bill of supply** | composition seller, or exempt or nil-rated goods only | no tax shown |
| **Cash memo / receipt** | unregistered seller | no tax |
| **Credit note** | return of goods, price reduction after supply, tax over-charged | refers to the invoice; carries the tax reversed; reported in the period it is issued, within the legal time limit (*verify*) |
| **Debit note** | upward revision after supply | same structure |
| **Receipt voucher / refund voucher** | advance received before supply (a plan or deposit) | tax on the advance when the rules require it (*verify for goods vs services*) |
| **Delivery challan** | stock moved without a sale, or stock transfer | no tax; needed for inter-store and e-way cases |

A bill is the **tax invoice** when the business is a regular registrant and the line is taxable. A mixed bill (taxable and exempt lines) is an invoice with a rate-wise split. The existing "Cash Bill" wording is kept only for an unregistered business.

### 6.2 Invoice numbering

- A **series per registration and financial year**, sequential, no gaps, unique, at most 16 characters, letters, digits, `/` and `-` only (*verify*). Example `RGP/25-26/000123`.
- The number is assigned when the bill is **completed**, never to a draft. A cancelled completed bill keeps its number and is marked cancelled (it appears in the documents-issued summary), it is not reused.
- Separate series for credit notes, debit notes and bills of supply.
- The existing per-business bill numbering and its concurrency test (bill-number concurrency) are the base; the GST series is the same counter with the financial-year prefix and the format check.

### 6.3 Tax computation on a bill

- Prices are **MRP-inclusive** for retail goods (existing). Taxable value = price / (1 + rate). Tax = price - taxable value. The till already works this way; the rate source changes (section 5).
- **Intra-state:** CGST = SGST = tax / 2, with the odd paisa to SGST (existing rule). **Inter-state:** IGST = tax. Decided by place of supply against the store's registration state.
- **Rounding:** tax is computed per line and summed per rate on the invoice; the **rate-wise invoice total** is what the return carries. Invoice total rounding (to the rupee) is a separate round-off line, outside the tax.
- **Discounts:** a discount given **on the invoice** reduces the taxable value before tax. A discount given **after** the supply (a scheme) is a credit note, not a silent price edit.
- **Cess,** where the rate row has it, as a separate column.
- **Free supplies and staff credit:** a supply to staff at a charge is a sale; a gift or free issue is recorded as a supply where the rules treat it so (*verify*), never as a stock write-off that hides tax.
- **Services and plans:** SAC, rate by date, place of supply per service rules; a plan sold in advance may need a receipt voucher (section 6.1).

### 6.4 Returns

- A sale return **always produces a credit note** in the original period's rate, with its own series number and the original invoice number and date. The credit note posts in the **month it is issued**, reducing that month's outward tax.
- With the **returns switch off** (catalogue doc, 3.7), a cancel is allowed only of an invoice not yet reported, by approval; otherwise a credit note by decision.
- Cash vs store-credit refund (existing) is a payment matter and does not change the credit note.

### 6.5 Customers and B2B

- A B2B sale needs the buyer's GSTIN, validated, and the place of supply. The invoice shows the buyer.
- **B2C large** (inter-state, above the notified invoice value) is reported invoice-wise; other B2C is reported as a **state- and rate-wise summary** (*verify the threshold in `gst_parameter`*).
- A GSTIN can be looked up by number against a cached copy of the portal's public data in a later phase; at first the user types and the checksum guards it.

---

## 7. Inward supplies (purchases) and input tax credit

### 7.1 Capture (exists, extended)

Invoice entry already stores supplier GSTIN, rate and the tax split. Add:
- **Rate check** against `taxFor(product, invoiceDate)` (flag, not block).
- **Document types:** invoice, **vendor credit note** (purchase return, rate difference), **vendor debit note**, bill of supply (composition or unregistered vendor, no credit), **import** (out of scope, noted).
- **Place of supply and tax type** validated against the vendor's state (the existing IGST decision), with an override and a reason.
- **ITC eligibility** per invoice line (below).

### 7.2 ITC eligibility

Each purchase line carries an `itc_status`:

| Status | Meaning |
|---|---|
| `eligible` | credit may be taken once the conditions hold |
| `ineligible_blocked` | in the blocked list (for example motor vehicles, food and beverages, club fees, personal use; *verify the list*) |
| `ineligible_exempt` | used for exempt supplies |
| `proportionate` | used for both taxable and exempt supplies: apportioned (the rule 42 / 43 method; *verify*) |
| `not_claimed` | the business chose not to claim yet (carry forward) |

Conditions the system checks before a line counts as **claimable** in a period:
1. The invoice is **in GSTR-2B** for the period (existing reconciliation status Matched or Accepted).
2. Goods or services are **received** (a goods receipt exists; for a service, the bill date).
3. The **supplier has filed** (visible through 2B).
4. **Time limit:** the credit is claimed by the notified deadline (*verify*, held in `gst_parameter`); an invoice older than that shows "time-barred".
5. **Payment within the notified days** for the credit to stay valid (the 180-day rule); the existing vendor payments table gives the payment date. A line past the limit without payment raises an **ITC reversal** entry, and a later payment allows re-claiming.

### 7.3 Reverse charge (RCM)

- Triggered by **category** (a rate row flagged `rcm`, for example specified services such as goods transport) or by **an unregistered vendor** where the notification requires it (*verify*).
- The purchase posts a **self-invoice** (and a payment voucher where needed), shows tax as **payable in cash** under 3B table 3.1(d), and the same tax becomes **eligible ITC** in the same or a later period.
- Marked on the invoice with `rcm = true`; excluded from the 2B match (it will not be there).

### 7.4 ITC ledger

`itc_ledger` entries: period, source (purchase line, credit note, RCM, reversal, opening, import, adjustment), CGST/SGST/IGST/cess, direction (+/-), reason. The sums equal the credit side of the return and the balance equals the **electronic credit ledger** after each filing (reconciled in 8.6).

### 7.5 Existing reconciliation

Unchanged in behaviour; it gains: ITC status per line, RCM exclusion, vendor credit notes in the match, the time-limit and 180-day warnings in the readiness check, and the link to the ITC ledger.

---

## 8. Returns and filing

### 8.1 Calendar

`gst_filing` rows per registration, return type and period, created from the registration's frequency and the parameter table:

| Return | For | Frequency | Due (as notified, stored as data) |
|---|---|---|---|
| GSTR-1 | outward supplies | monthly, or quarterly with the invoice furnishing facility | 11th of next month (quarterly: the 13th after the quarter) |
| GSTR-3B | summary and payment | monthly, or quarterly with the payment scheme | 20th (quarterly: 22nd or 24th by state) |
| CMP-08, GSTR-4 | composition | quarterly / annual | as notified |
| GSTR-9, 9C | annual return, audit reconciliation | yearly | 31 December of the next year (*verify*) |

Alerts (existing engine): "GSTR-1 due in 3 days", "GSTR-3B not filed", "period not locked", assigned to the Business Head and any accountant. A filing has a status: `not_started`, `in_preparation`, `ready`, `filed`, `late`, with the **ARN** and filing date entered when filed.

### 8.2 GSTR-1 data (outward)

Built from the posted documents of the period:

| Table | Content | Source |
|---|---|---|
| 4A/4B | B2B supplies (and RCM B2B) | invoices with a buyer GSTIN |
| 5 | B2C large invoices | inter-state B2C above the limit |
| 6 | exports, SEZ | later |
| 7 | B2C other, state and rate-wise | the rest of the B2C bills |
| 8 | nil-rated, exempt, non-GST | by class |
| 9 | amendments to earlier periods | corrected documents |
| 9B | **credit and debit notes** (registered and unregistered) | credit/debit notes issued in the period |
| 11 | advances received and adjusted | receipt and refund vouchers |
| 12 | **HSN-wise summary** | quantity, value, taxable value and tax by HSN/SAC and rate (HSN digit length from the parameter table by turnover) |
| 13 | documents issued | series, from, to, total, cancelled |

Output: a **JSON file in the portal's offline-tool format** and a readable Excel, plus the **invoice-level reports** the CA checks. A pre-flight list blocks or warns: invoice with no HSN, no place of supply, GSTIN failing the checksum, gaps in the series, a tax figure that does not recompute, a document in a locked other period.

### 8.3 GSTR-3B workings

Computed, never typed:

| Table | Content |
|---|---|
| 3.1(a) | outward taxable supplies (other than zero-rated, nil, exempt) |
| 3.1(b), (c), (e) | zero-rated, nil/exempt, non-GST |
| 3.1(d) | inward supplies under reverse charge |
| 3.2 | inter-state to unregistered, composition, UIN |
| 4(A) | ITC available: imports, RCM, ISD, others (from the ITC ledger, the reconciled 2B figures) |
| 4(B) | ITC reversed (rules 37, 38, 42, 43, 17(5), other) |
| 4(C), (D) | net ITC and ineligible ITC |
| 5 | exempt, nil and non-GST inward |
| 5.1 | interest and late fee |
| 6.1 | payment: tax payable minus ITC used, cash paid, utilisation order (IGST credit first, then CGST/SGST per the set order) |

The workings page shows each figure with a **drill-down to the documents** behind it, and a **difference to the filed GSTR-1** (3.1 against GSTR-1 totals) so a mismatch is seen before filing.

### 8.4 Payment and ledgers

- **Liability ledger:** per period, tax payable by head, from 8.3.
- **Credit ledger:** the ITC ledger (7.4) with utilisation.
- **Cash ledger:** deposits (challan number, CIN, date, amount, head-wise), utilisation, balance. A challan is entered by the user from the bank payment (and matched to the bank statement already imported in Finance).
- **Interest and late fee:** computed from the due date, the filing date and the unpaid tax, with the rates from the parameter table; shown as a figure to pay with the return, not auto-posted.

### 8.5 Filing workflow

1. The period's documents are complete; the pre-flight (8.2) is clean.
2. The accountant or Business Head **reviews** GSTR-1 data and 3B workings, and sets the filing to `ready` (maker-checker where the business has a separate approver, existing approval mode).
3. The file is downloaded, uploaded to the portal by the person who files, and the **ARN and date** are recorded; the period is **locked** (existing period lock, extended to sales documents).
4. After filing, a **snapshot** of the figures filed is stored (immutable), so a later difference can be explained.
5. Amendments and credit notes for a filed period go into the **next** period's tables (9, 9B), as the portal requires.

### 8.6 Reconciliations (the proof)

| Check | Rule |
|---|---|
| Sales register to books | sum of posted invoices less credit notes = total sales for the period in the sales reports |
| Register to GSTR-1 | table totals = register totals, by rate |
| GSTR-1 to 3B | 3.1 figures = GSTR-1 totals, any difference explained |
| 2B to ITC | claimed ITC = matched 2B + RCM + reversals, difference listed |
| ITC ledger to credit ledger | balance after filing = the portal's credit ledger (user enters the closing balance, difference flagged) |
| Documents issued | numbering has no gaps |

### 8.7 Annual return

GSTR-9 (and 9C where the turnover requires) is **prepared from the twelve months of filed snapshots**: tables 4 to 8 (outward, inward, ITC), 9 (tax paid), 10 to 14 (amendments, additions), 15 to 19. Phase later; the structure above (snapshots, rate-wise and HSN totals) is what makes it possible.

---

### 8.8 Files to and from the GST portal

The first versions do not connect to the portal. The user **downloads** files from the portal and **uploads** them here, and **downloads** files from here to upload on the portal (or hands them to the CA). Later (G8) a GSP automates both directions with the same files and the same staging tables. Portal file layouts change; each layout is handled by a **versioned reader or writer** (version held in `gst_parameter`), and anything not recognised is kept and listed, never silently dropped (*verify the current portal layouts when building*).

**Files the app produces (for upload on the portal or for the CA)**

| File | For | Format | Notes |
|---|---|---|---|
| GSTR-1 | outward supplies, the tables of 8.2 | portal JSON (offline-tool layout) with sections `b2b`, `b2cl`, `b2cs`, `cdnr`, `cdnur`, `exp`, `nil`, `hsn`, `doc_issue`, `at`, `txpd`, plus amendment sections, and an Excel with the same data by table | split into several files when a file or invoice-count limit is reached (*verify limits*); each file named with GSTIN, period and part number; a **checksum of totals** is shown so the person can compare with the portal's summary after upload |
| IFF (quarterly filers) | B2B invoices of months 1 and 2 | same JSON layout, B2B and credit notes only | |
| GSTR-3B | the workings of 8.3 | portal JSON where the portal accepts it for the form (*verify*), else a **data-entry sheet** laid out table by table in the order of the portal screen | the sheet is the fallback and always produced |
| Portal error report reader | upload rejected by the portal | the error file the portal returns (JSON or Excel) | uploaded here, each error is **mapped back to the invoice or credit note** (by invoice number and GSTIN) and shown on the pre-flight list with the portal's message, so it is fixed at the source and the file regenerated |
| E-invoice JSON | invoice registration (when 10 applies) | the invoice registration portal's schema | generated from the invoice; the returned IRN is entered or imported (see below) |
| E-way bill bulk JSON | e-way bill portal | the bulk-generation layout | from delivery and transfer documents |
| Records for the CA | any period | Excel pack: sales register, purchase register, HSN summary, ITC working, reconciliation, with a cover sheet | one button, for an external accountant |

**Files the app reads (from the portal, for reconciliation and checks)**

| File | Source | What it feeds | State today |
|---|---|---|---|
| **GSTR-2B** (JSON and the Excel download) | portal, monthly | ITC claimable: sections `b2b`, `b2ba` (amended), `cdnr` and `cdnra` (credit/debit notes), `isd`, `impg`, `impgsez`, and the "ITC not available" and "reversal" parts of the summary | **JSON `b2b` section only is read today.** Add the other sections, the summary totals check, and the Excel layout |
| **GSTR-2A** (JSON, Excel) | portal, dynamic | supplier filing status between months, late filers | same limit as 2B |
| **GSTR-1 as filed** (JSON or the summary) | portal | proves what was filed, the ARN, differences to the register | not built |
| **GSTR-3B as filed** (PDF or JSON) | portal | tax paid, ITC claimed, differences to the workings | not built |
| **Electronic ledgers** (cash, credit, liability, Excel or PDF) | portal | balance checks of 8.6, challan details for 8.4 | not built |
| **Invoice Management System actions** (accept, reject, pending on 2B invoices) | portal | the worklist's accept, dispute and hold map to these actions; the app exports the list of invoices to act on and reads the portal's current action back (*verify the feature's current rules*) | not built |
| **E-invoice / IRN list** (download) | portal | confirms IRNs were issued for each B2B invoice | later |
| **GSTR-9 auto-populated data** | portal | annual return preparation | later |
| **Notices, demands, registration certificate** (PDF) | portal | kept in the records register with the date, the period and a note; not parsed | records only |

**Import pipeline (the same for every file)**
1. **Upload** the file (JSON, Excel, PDF where it is only a record). Keep the **original file** with its hash, name, size, who and when, against the business, and keep it for the records period.
2. **Detect** type, GSTIN, return period and version from the content, not the file name. Refuse a file whose GSTIN is not one of the business's registrations or whose period is not the one chosen, with the reason.
3. **Parse into staging rows**, with the original section and row number kept so any figure can be traced to the file.
4. **Check against the file's own totals** (the summary inside the file where there is one) and show a **load report**: rows read per section, sections not read, rows rejected and why, totals matched or not.
5. **Commit** as one batch, replacing the previous batch of the same type and period (the idempotence of the present import), and run the matcher or the check that the file feeds.
6. **Audit** the load and keep the report.

Excel files are read with the spreadsheet library the app already uses for reports, by **column heading** (with a mapping screen when headings differ), because the portal's Excel layouts and the headings people edit by hand vary.

**Screens:** GST > **Portal files**: for each period, the files expected (GSTR-2B, GSTR-2A, GSTR-1 filed, GSTR-3B filed, ledgers), whether each is loaded, the load report, and the downloads the app produced with the date and who downloaded them; an **error report** upload next to each GSTR-1 file.

**Privacy and safety:** the files hold the business's own data and its trading partners' GSTINs, so they are stored per business with the normal access rules and are never sent anywhere (no third-party service) in the first versions. Files uploaded are treated as data, never as instructions.

## 9. Rate change: the full workflow

The scenario: stock bought at 12%, rate becomes 5% from a date, only new purchases come at 5%.

### 9.1 Set up the change

1. **Gst rate master** > "New rate" (or the bulk form): choose HSN/SAC codes or a category, the new rate, the **effective date** and the notification. The system closes the old row at the day before and opens the new one. It refuses an overlap.
2. **Preview** (before saving): the products affected, the stock on hand by batch with its purchase rate, the **sale price today and the price after the change under each policy** (below), the open (unfinished) bills and unfulfilled orders that fall on or after the date, and the effect on the bill print and the MRP guard.
3. **Alert** to the Business Head and store heads N days before the date.

### 9.2 Price policy for old stock (per product or per set)

| Policy | Customer price | Taxable value | Note |
|---|---|---|---|
| **Keep MRP** | unchanged | rises (price / 1.05) | the shop keeps the saving; may attract the anti-profiteering provision; needs the CA's confirmation (*verify*) |
| **Pass the saving on** | falls to old taxable value x 1.05 | unchanged | the safe route; the MRP on the pack is higher than the price billed, which is allowed when the price is lower |
| **Re-stick to a new MRP** | new MRP | new MRP / 1.05 | for stock that can be relabelled; the MRP guard uses the new MRP for that batch |

The choice is **per product with a default for the set**, needs approval above a set impact (the existing pricing-governance approval), and is recorded with the notification. Worked example in section 14.

### 9.3 On the effective date

- A scheduled job (or lazy resolution by date, section 5) switches the rate for **every bill dated on or after the date**. Nothing is edited in the old documents.
- The **MRP guard and price ceiling** use the new rate, so the maximum billable price is MRP-inclusive at 5%.
- **Bills dated before** the date but still open (drafts, pending) keep their date and rate if completed on the old day; a bill completed after the date takes the new date and rate.
- **Backdating** a bill across the date is refused unless the period is open and an approver gives a reason.

### 9.4 Credit and filing effects

- **Output:** sales from the date are reported at 5% in GSTR-1 table 12 (HSN summary by rate) and 3.1(a).
- **Input:** the purchases keep the credit at 12%; reconciliation with 2B still uses the invoice rate; the ITC ledger is unchanged.
- **Accumulated credit:** stock sold at 5% against credit taken at 12% leaves credit carried forward each month. The dashboard shows **ITC carried forward** and its trend; whether any refund route (for example for an inverted rate, with its conditions and time limits) applies is the CA's decision (*verify*) and is held as a **note on the period**, not automated at first.
- **Vendors still billing old rates** after the date: the rate check (7.1) flags the invoice; a vendor credit note for the difference is expected and tracked in the vendor issues module.

### 9.5 Rate increases and exemptions

- An **increase** on stock in hand cannot be recovered through a higher tax on a fixed MRP; the preview shows the margin loss and offers the same three policies.
- A change **to exempt or nil-rated** turns the class off for sales; the ITC on the stock may need reversal (rule 42 style; *verify*); the system lists the stock value and the credit involved and creates the reversal **as a proposed entry for the accountant's approval**.

### 9.6 Reports for a rate change

- **Rate-change impact:** stock by batch with old and new tax, price under each policy, sales since the date by rate, credit carried forward.
- **Products whose rate disagrees with the master** (overrides, stale HSN).
- **Anti-profiteering evidence:** for each changed code, the average price and the taxable value before and after, kept for the period the law requires (*verify*).

---

## 10. Multi-store, transfers, e-invoice and e-way bill

- **Registrations:** a store belongs to a GSTIN. Stores of one GSTIN can transfer stock freely (delivery challan, no tax). A transfer between **different GSTINs (different states)** is a **supply**: a tax invoice with IGST, an e-way bill where the value limit is crossed (*verify*), reported in GSTR-1 and available as ITC to the receiving store. This extends the existing `transfers` module.
- **E-way bill:** needed for movement of goods above the notified value (purchases from out of state arrive with the vendor's; the business generates its own for its transfers and large deliveries). Phase later: capture the e-way bill number on a purchase or delivery, and, with a GSP, generate it.
- **E-invoice:** mandatory for registered businesses above the notified turnover for B2B, export and a few other supplies (*verify the limit and whether it applies*). It needs an **IRN and QR** from the invoice registration portal within the notified days of the invoice. Design: the invoice JSON is already complete from 6.1; a `einvoice` record holds IRN, ack number, ack date, signed QR and status; a cancelled IRN window is respected; the print shows the QR. Built only if the business crosses the limit, through a GSP.

---

## 11. Data model summary

| Table | Purpose |
|---|---|
| `gst_registration` | GSTIN per state, scheme, frequency, dates |
| `gst_rate` | HSN/SAC rate master with effective dates |
| `gst_parameter` | thresholds, due dates, late fee and interest rates, HSN digits, limits, with effective dates |
| `product.hsn_sac`, `tax_override_pcnt (+from/to)`, `gst_applicable` | per-product tax class |
| `sale.gst_registration_id`, `place_of_supply`, `buyer_gstin`, `invoice_series`, `invoice_no`, `doc_type` (invoice, bill of supply, credit note, debit note) | document header |
| `sale_item.hsn_sac`, `rate_pcnt`, `cess_pcnt`, `taxable_value`, `cgst`, `sgst`, `igst`, `cess`, `supply_class` | stored per line (immutable) |
| `credit_note` (and lines) | issued against a sale invoice, from a return or a price change |
| `purchase_item.itc_status`, `itc_reason`, `rcm` | credit control |
| `vendor_note` (credit/debit) | vendor adjustments |
| `itc_ledger` | every credit movement |
| `gst_filing` | return, period, status, ARN, filed date, snapshot, prepared-by, checked-by |
| `gst_payment` | challans: number, CIN, date, head-wise amounts |
| `gst_snapshot` | the figures as filed (JSON), immutable |
| `gst_portal_file` | every file uploaded or produced: type, GSTIN, period, version, hash, name, size, direction, status, load report, who, when; the original kept |
| `gst_staging_row` | rows read from a file before commit, with section and row number |
| `rate_change` (+ `rate_change_item`) | the dated change, its preview, the price policy chosen and the approval |
| `einvoice` | IRN data (later) |

Existing tables stay: `gst_return_period`, `gst_inward_supply`, `gst_reconciliation`. `gst_return_period` becomes the lock record and links to `gst_filing`.

---

## 12. Screens and API

**Settings > GST** (Business Head and, where the role exists, an Accountant): registrations, scheme, frequency, rate master (search by code, history, new rate, bulk change with preview), compliance parameters (read, with a change log), invoice series.

**GST > Overview:** the calendar of filings with status and due dates; this period's liability, ITC claimable, carried forward; rate-change alerts.
**GST > Sales register:** invoices and credit notes by period, filters by rate, buyer, type; export.
**GST > GSTR-1:** pre-flight, table totals, HSN summary, download JSON and Excel, mark ready/filed.
**GST > GSTR-3B:** workings with drill-down, difference to GSTR-1, interest and late fee, payment entry.
**GST > Purchases and ITC:** the existing reconciliation (kept), plus ITC status, RCM, reversals, time-barred list, vendor credit notes.
**GST > Ledgers:** liability, credit, cash.
**GST > Portal files:** every file to and from the portal, load reports, error reports (8.8).
**GST > Rate changes:** list, preview, price-policy screen, impact report.
**GST > Reconciliations:** the checks of 8.6 with their status.

API: `/gst/registrations`, `/gst/rates`, `/gst/rates/preview`, `/gst/rates/bulk`, `/gst/parameters`, `/gst/sales-register`, `/gst/gstr1/:period` (+ `/export`), `/gst/gstr3b/:period`, `/gst/itc`, `/gst/ledgers`, `/gst/filings`, `/gst/payments`, `/gst/rate-changes`, `/gst/reconcile/:period`. All behind the `gst` module and permission groups (`gstview`, `gstprepare`, `gstfile`, `gstmaster`). A new **Accountant** role: read everything in GST and finance, prepare returns, cannot change master data or file.

---

## 13. Controls, audit and roles

- **Immutable documents:** an issued invoice or credit note cannot be edited or deleted; the existing edit-bill window for same-day bills is replaced, for a GST-registered business, by "cancel and reissue" with approval, keeping both numbers.
- **Period lock** on filing, extended from purchases to sales and credit notes; unlocking needs the Business Head and a reason, audited.
- **Audit:** every master change (rate, parameter, registration), every override, every filing status change, every lock, with before and after (existing audit service).
- **Segregation:** the person who prepares is not the one who marks it filed, when the business has more than one person (existing approval-mode setting).
- **External accountant access:** a read-only login with downloads, no master edits.
- **Retention:** records kept for the legal period (*verify*), tied to the 8-year records check already in Finance.

---

## 14. Worked example (the rate change)

A pack bought at cost 80 plus 12% GST (credit 9.60), MRP 112 (printed, GST at 12% inside: taxable 100, tax 12). The rate becomes 5% from the date.

| | Before | After, **keep MRP** | After, **pass the saving on** |
|---|---|---|---|
| Customer price | 112.00 | 112.00 | 105.00 |
| Taxable value | 100.00 | 106.67 | 100.00 |
| Output GST | 12.00 | 5.33 | 5.00 |
| Credit on this pack's purchase | 9.60 | 9.60 | 9.60 |
| Net GST for this pack | 2.40 payable | 4.27 credit | 4.60 credit |
| Shop's margin before credit effect | 20.00 | 26.67 | 20.00 |

- GSTR-1 table 12 carries the pack at 5% from the date; 3B 3.1(a) carries 5.33 or 5.00; 4(A) carries the 9.60 credit when the purchase appeared in 2B.
- The ITC carried forward grows by the difference each month, shown on the overview.
- The first policy raises margin by taxing less while charging the same; the second is the usual safe route against the anti-profiteering rule. The choice and its reason are stored with the rate change.

---

## 15. Phasing

| Phase | What | Fixes | Size |
|---|---|---|---|
| **G1** | Rate master (usable even before a business registers), parameters, `taxFor` by date, bulk change with preview, price policy, rate-change alerts and report; retire the global cap; HSN/SAC on products | the scenario; correct sale rate by date | M |
| **G2** | Registration profile with the **not-on-GST states and the go-live switch** (3.1), GSTIN validation; place of supply; IGST on sales; invoice series and documents (tax invoice, bill of supply); per-line tax stored; credit notes from returns; B2B buyer capture | compliant sales documents | L |
| **G3** | Sales register, HSN summary, documents-issued, GSTR-1 tables and **portal JSON and Excel files with the error-report reader** (8.8), pre-flight, filing record and period lock for sales | outward filing | L |
| **G4** | GSTR-3B workings and **its JSON or data-entry sheet**, load of **GSTR-1 and 3B as filed and the ledgers** (8.8), liability and credit ledgers, payments, interest and late fee, differences to GSTR-1, filing workflow with ARN and snapshots | monthly return and payment | M |
| **G5** | **Complete GSTR-2B/2A reading (all sections, Excel, totals check, IMS actions)**, ITC controls: eligibility, blocked credit, reversal (180-day rule), RCM with self-invoice, vendor notes, time-barred list, ITC ledger tied to reconciliation | credit correctness | M |
| **G6** | Compliance calendar and alerts, reconciliations of 8.6, accountant role, snapshots, readiness dashboard | the routine | S |
| **G7** | Multi-GSTIN stock transfers as supplies, e-way bill capture, e-invoice (if turnover requires) | multi-state and large business | L |
| **G8** | GSP integration (fetch 2B and the filed returns, file), GSTR-9 preparation, GSTIN lookup | straight-through | L |

G1 to G4 deliver a complete monthly cycle for a single-GSTIN retailer. G5 and G6 make it safe. G7 and G8 are for growth.

**Dependencies:** the catalogue work (service SAC, plans' advances) feeds G2; the returns switch and credit notes tie to 6.4; the finance bank import ties to payments in 8.4; the alerts engine and the period-lock code already exist and are reused.

---

## 16. Testing

- **Golden cases** (table-driven unit tests, no database): rate lookup by date and longest prefix; overlap refused; intra vs inter-state split and the odd paisa; rate-wise invoice rounding; discount before tax; credit note at the original rate; ITC eligibility, time limit and the 180-day rule; RCM; HSN summary totals; the worked example of section 14.
- **QA API specs:** the rate change from preview to effective date, with a bill before and after; a backdated bill refused; invoice series without gaps under concurrent billing; credit note from a return; GSTR-1 totals equal the register; GSTR-3B 3.1 equals GSTR-1; a locked period refuses a change; the Accountant role is read-only for master data.
- **Fixtures:** a small set of real-shaped GSTR-2B and GSTR-1 files per scenario (kept without any customer data).
- **Property checks:** for any set of generated bills, register total = sum of lines = GSTR-1 totals = 3B 3.1.

---

## 17. Risks and decisions

**Risks**
- Rules change; the design isolates them as data, but loading and checking them is an ongoing duty. A named owner (the CA) must sign off each parameter set.
- Printing a tax invoice on every bill adds fields the counter must capture (buyer GSTIN, place of supply for deliveries); the till must stay fast for the common B2C case.
- Changing posted-bill editing rules will meet resistance at the counter; the same-day edit window needs a considered replacement.
- E-invoice and GSP integration involve third parties, fees and credentials the app must hold safely.
- The ITC rules (blocked credit, apportionment, reversal) are subtle; the first version should flag and propose, not decide.

**Decisions to take**
1. Which registration does each business have today (none, registered but not filing, regular, composition) and is it one GSTIN or more? This sets the first scope and the default state for a new business of each type. For a business not yet on GST, show the turnover-versus-limit watch from day one and ask the go-live questions only when it registers.
2. Monthly or quarterly (QRMP) filing?
3. Does anyone else (an external CA) file, and should they get a login with the Accountant role?
4. For the current rate change, which price policy is the default: keep MRP or pass the saving on (CA to confirm)?
5. Is the business near the e-invoice turnover limit?
6. Accept the **cancel-and-reissue** rule for issued invoices of a GST-registered business, replacing free editing of same-day bills?
7. Build order: G1 first (the scenario), then G2 to G4 as one block, or G1 to G3 first?
8. Export format: portal JSON and Excel only at first, or also Tally or another accounting package?
9. Who maintains the rate master after launch: the business, or the provider's periodic update with the business approving?
