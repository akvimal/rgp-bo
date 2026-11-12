# Expiry management revamp (planned 2026-11-12, not built)

Why: most vendors do not take back expired or near-expiry goods, yet Stock > Expiry offers only "Return to vendor"; discarding goods has no out-pass; old-version data holds expiry write-offs adjusted in bulk or singly under other reasons; the stock audit is not tied to expiry. Builds on the stock adjustment + approval flow, the audit module's Expiry sweep plan, and `STORE_LOG_BOOK.md` (disposal register first).

## Decisions (owner, 2026-11-12)
1. An out-pass is approved by a **Store Head or Business Head**, always, whatever the value. A **photo or receipt is optional**.
2. **Schedule H, H1 and X** items **link to the drug register** (online register of the pharmacy pack).
3. **Stock drops when the goods are confirmed handed over / destroyed**, not at approval. (Between approval and handover the quantity is held: it cannot be sold, but stays on the books.)
4. **Clearance is not built** (owner, 2026-11-12). Near-expiry stock is moved, returned (where the vendor takes back) or discarded.
5. **Old write-offs are only tagged** ("before disposal records"); no retrospective out-passes.
6. **Held quantity is its own column** on the stock screens (Stock > Products and the Expiry screen).
7. **Second witness** for Schedule H / H1 / X lines can be **any second staff member**; it is not needed when the person confirming is a Business Head or Store Head. (Reading of the answer "any second staff member (if not business head or store manager)": confirm when built.)

## 1. Expiry screen
- Bands: Expired on books | Expiring in 30 days | 31-90 | 91-180. Each row: product, batch, expiry, qty, value at cost, vendor, "vendor takes back?".
- Row actions: Return to vendor (only when the batch's vendor takes back, within its window), Move to another store (existing transfer), Discard (out-pass). Columns include Held (quantity in an approved out-pass not yet handed over). Multi-select: create one out-pass or one vendor return for the selected.
- **Vendor setting** `takes_back` (NONE / NEAR_EXPIRY / EXPIRED / BOTH) and `takeback_days`, on the vendor master. Default NONE for existing vendors, so Return is not offered until set.

## 2. Out-pass (discard / destroy / hand to agency / return)
States: DRAFT -> APPROVED (held, not saleable) -> HANDED OVER / DESTROYED (stock drops) ; REJECTED / CANCELLED releases the hold.
- Number per business per year (OP-2026-0007), store, date, lines (product, batch, expiry, qty, cost value, tax value, MRP value), reason (expired / near expiry / damaged), method (destroyed on site / authorised disposal agency / returned to vendor / other), agency or carrier, prepared by, approved by (Store Head / Business Head), witness, optional photo or receipt, confirmed by and when.
- Printable PDF with signature blocks. A line is an existing stock adjustment (reason EXPIRED or DAMAGED) created at confirmation, so the approval gate, trail and audit keep working; `product_qtychange.disposal_pass_id` links it.
- Schedule H / H1 / X lines: the register entry is made at confirmation (pharmacy pack hook) and a second witness (any other staff member) is required unless the person confirming is a Business Head or Store Head.
- Alerts: approved but not confirmed after N days; expired stock still on books.
- Tax value is stored for the GST module: written-off or destroyed goods normally mean reversing input tax credit (confirm with the CA).

## 3. Old-version data
- **Backlog of expired stock still on the books:** one out-pass marked "disposed earlier, recorded now" (physical date, no witness or evidence required), approved by a Store Head / Business Head, confirmed in the same step.
- **Past write-offs under other reasons:** a one-time review lists adjustments that look like expiry (reason Expired; or the batch was expired / within 30 days of expiry when adjusted; or free text such as "expir" or "breakage"). Per row: confirm as expiry, not expiry, or leave. Stock never changes. Tag `legacy_expiry` = true on `product_qtychange`: shown as "before disposal records", no out-pass.
- **Statement** by month and financial year of expiry write-off value (cost, tax) for the audit and the CA. Study first: count expired-on-books batches and legacy write-offs by month and value on a copy of the real data.

## 4. Audit integration
- Expiry sweep sheet carries expiry; an expired or near-expiry batch found gets "Create out-pass" (pre-filled, linked to the audit through the existing `audit_id`).
- A variance on an expired batch (books have stock, shelf empty) is classed "unrecorded disposal": needs an out-pass (or an explanation) before the audit is approved.
- Certificate gets an expiry section: expired on books, near expiry, out-passes in the period and their state.
- An audit is not closed while expired stock is on the books, unless each item has an out-pass in progress or a stated reason.

## Build order
1. Vendor take-back setting, new Expiry screen, out-pass (new disposals, held quantity, confirmation, PDF, drug register link, alerts).
2. Legacy backlog, past write-off review, statement.
3. Audit integration.
4. Tax value to the GST module; printable register.

## Open points
- The witness rule above (reading of the owner's answer).
