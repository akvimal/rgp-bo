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

## Build status: step 1 (2026-11-12)
Built and tested locally, committed. Migration 185 (applied to the local dev database only).
- Vendor `takes_back` / `takeback_days` (vendor form: "Takes back expired goods", "Within (days of expiry)").
- Out-pass: draft -> approved (held: on the books, not saleable) -> confirmed (stock drops, one adjustment per line linked to the pass); reject, cancel; numbering OP-YYYY-NNNN per business; printable PDF; approval by a Store Head or Business Head (own pass only for owners or "maker may approve" stores); witness for H/H1/X lines confirmed by a non-manager; scheduled lines go in `schedule_disposal_register`.
- Held is subtracted in billing validation, batch suggestions and store transfers; a Held column shows on Stock > Products (batch table) and on the Expiry screen.
- Stock > Expiry: bands (Expired / 30 / 31-90 / 91-180 days) with counts, per-row Return to vendor (only where the vendor takes back), Move (links to Transfers), Discard; select several for one out-pass. Stock > Out-passes: list and detail with approve, reject, cancel, confirm, print.
- Specs: `disposal-rules.spec.ts` (8), QA `disposal-pass.spec.ts` DISP-1..7.
Not built in step 1: the alert for an approved pass not confirmed after N days; a Disposals tab on the Drug register screen (the register lines are stored and shown on the pass); Move does not preselect the batch on the Transfers screen; Return to vendor still goes through the adjustment form, not a pass.

## Build status: step 2 (2026-11-12)
Built and tested locally, committed. Migration 186 (applied to the local dev database only).
- **Backlog:** Stock > Expiry, Expired band: "Record as disposed earlier" makes and confirms one out-pass (marked `legacy`, "disposed earlier, recorded now") for the ticked expired batches, or all of them; a Store Head or Business Head, for a day not in the future; no witness or evidence.
- **Review of old write-offs:** Stock > Write-offs > Review lists old adjustments (negative, approved, no out-pass, not a transfer or return) that look like expiry: reason Expired, the batch had expired or was within 30 days of expiry on the day, or the words ("expir", "out of date", "breakage", "wastage", "discard" ...). A manager confirms them as expiry or not (or clears the choice). Tag `product_qtychange.expiry_tag`; the adjustment never changes.
- **Statement:** Stock > Write-offs > Statement (and Excel): by month and financial year (April to March): out-passes (expired / near expiry, not returns to the vendor), disposed-earlier passes, old write-offs confirmed as expiry; at cost before GST plus the GST paid on that cost.
- Specs: rules (11), QA `expiry-legacy.spec.ts` LEG-1..5.
Not built: the alert for an approved pass not confirmed after N days; a Disposals tab on the Drug register screen; Move preselecting the batch on Transfers. Step 3 (audit integration) and step 4 (tax value to GST, printable register) remain.

## Build status: the three small items (2026-11-12)
Built and tested locally, committed. No migration.
- **Alert** `disposal_unconfirmed`: an out-pass approved and not confirmed for N days (default 3, 0 to 60) raises a warning for owners and managers, per store, linking to the pass; it clears when the pass is confirmed or cancelled. English and Tamil text.
- **Drug register, Disposals tab:** scheduled drugs (H, H1, X) that left through a confirmed out-pass, numbered in their own series (D-H1-0001), with why and how, who confirmed, the witness, and a link to the out-pass; `GET /schedule/disposals`.
- **Move:** the Move button on the Expiry screen opens a transfer from the store in the header with the batch and its sellable quantity chosen.
- Specs: QA `expiry-extras.spec.ts` EXX-1..3; the built-in alert list in `alerts.spec.ts` ALRT-1 brought up to date.
Remaining: step 3 (audit integration), step 4 (tax value to the GST module, printable register).

