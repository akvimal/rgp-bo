# Prod-data validation plan (upgrade 007 → 037)

Goal: prove that the current app, running on a copy of the live database after migrations `008`–`037`, shows the same history and behaves correctly, **before** the real cutover. Work through the sections in order; tick each item, note any finding in the Result line.

## 0. Environment

| What | Value |
|---|---|
| Untouched copy of prod (reference) | database `rgp_baseline` in container `rgp-db-dev` |
| Migrated copy (what the app uses) | database `rgp_rehearsal` |
| App | http://localhost:8100 (API on 3000 is pointed at `rgp_rehearsal`) |
| Logins | `admin@rgp.com`, `vimalkrish@rgp.com`, `srividhya@rgp.com`, `lakshman@rgp.com`, `purushoth@rgp.com`, `nirmal@rgp.com`, password `rgp@123` (copy only) |
| Source dump | `D:\workspace\rgp-migration\rgp_prod.dump` (outside the repo; contains customer data, never commit) |

SQL helper (PowerShell):
```powershell
function q($db,$sql){ docker exec rgp-db-dev psql -U rgpapp -d $db -c $sql }
```

Reset the migrated copy at any time by re-restoring the dump, re-applying the migrations and re-running the password reset. Everything done in the app is written to the copy only.

## 1. Decisions and blockers (resolve first)

These came out of the rehearsal. Items marked **BLOCKER** must be fixed in the migration set before cutover.

| # | Finding | Evidence | Action |
|---|---|---|---|
| D1 | **FIXED** Migration `002` adds `UNIQUE(bill_no)` across all years, but bill numbers restart each fiscal year | 46,242 cross-year repeats; in-year duplicates in 2022 (~1,537) and 2024 (~2,388) | `002` rewritten: no global unique constraint (legacy duplicates stay as they are); row-locking `generate_bill_number()` and a safe `sales_meta` counter instead. Re-runnable. **Decided:** keep prod's behaviour, numbering restarts on 1 Jan (the key is 31 Mar of the calendar year). First bill of 2027 should be 1; add a check for it |
| D2 | **FIXED** `stores` is empty after `014`, so `029` fails | `column "store_id" ... contains null values` | New `028a_ensure_main_store.sql` creates "Main Store" (first business) and assigns every active user to it. Rename it in Settings → Store |
| D3 | **FIXED** Role names differ from the code | Prod roles: `Admin`, `Sales Staff`, `Store Head`. Code requires `Site Admin`, `Business Head`. `037` matched no role | New `007a_prod_roles_reconcile.sql` (run before `008`): `Admin` → `Business Head` with current seed permissions, adds `Site Admin` |
| D4 | **SCRIPT READY, cutoff date to choose** All 1,739 purchase invoices show Unpaid/Overdue because prod never recorded vendor payments (the app derives status from `vendor_payment`) | 1,714 COMPLETE (₹74.9 lakh) + 25 drafts (₹1.28 lakh) | `sql/prod-upgrade/opening_payables.sql -v cutoff=YYYY-MM-DD` writes one `OPENING` payment per COMPLETE invoice before the cutoff; dry-run with `-v dry_run=1`. Tested with 2026-08-01: 1,637 settled (₹71.9 lakh), 77 stay open (₹2.98 lakh). Re-runnable |
| D5 | HR/payroll tables exist in prod (`employee_salary_structure` 5, `payroll_run` 1, `payroll_detail` 5, KPI tables) but the current app has no HR screens | tables came from the `main` branch | Keep as inert tables for now, or drop after go-live |
| D6 | Uploaded files are not in the dump | `upload/` folder on the VPS | Copy the folder; decide the path the new app reads |
| D7 | 415 stock batches have negative available quantity in prod | `stock_view` | Data-quality note, identical before and after; decide whether to clean up |

## 2. Data integrity (run first; all must pass)

Baseline numbers come from the prod dump, taken 2026-10-20.

| ID | Check | Expected | Result |
|---|---|---|---|
| PV-01 | Row counts: sales 61,847; sale items 163,528; purchase invoices 1,739; customers 3,355; products 3,469 | Equal in `rgp_baseline` and `rgp_rehearsal` | ☐ |
| PV-02 | Sales value ₹14,604,357.48; per year 2022 10,690 / ₹2,502,065.15, 2023 12,091 / ₹3,093,143.56, 2024 12,666 / ₹3,139,278.77, 2025 14,801 / ₹3,313,310.00, 2026 11,599 / ₹2,556,560.00 | Identical in both databases | ☐ |
| PV-03 | Stock view: 15,944 batches, 4,473,029 units, 15,395 with stock, 415 negative | Identical in both | ☐ |
| PV-04 | No NULL `store_id` on `sale`, `purchase_invoice`, `product_qtychange` | 0 rows | ☐ |
| PV-05 | Sequences are ahead of data: `sale_id_seq` last_value ≥ `max(sale.id)`, same for other tables | No sequence behind | ☐ |
| PV-06 | No orphan foreign keys (sale items without a sale, invoice items without an invoice, sales without a customer) | 0 rows | ☐ |
| PV-07 | Totals per customer: pick 10 customers incl. the highest spenders | Same totals in both databases | ☐ |

```sql
-- PV-01/02/03, run against each database and diff the output
select count(*), round(sum(total)::numeric,2) from sale;
select to_char(bill_date,'YYYY'), count(*), round(sum(total)::numeric,2) from sale group by 1 order by 1;
select count(*), sum(available_qty) from stock_view;
-- PV-04
select count(*) filter (where store_id is null) from sale;
```

## 3. Sales, bills and returns (migrations 018, 021, 029, 008, 009)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-10 | Sales list: open bills from 2022, 2024 and the last week; compare with the live app | Same bill number, date, customer, items, totals, payment split | ☐ |
| PV-11 | Search a known customer by name and by mobile | Same results as live; history opens | ☐ |
| PV-12 | Print/preview an old bill | Layout and amounts match | ☐ |
| PV-13 | Create a new sale (open a shift first, see §6) | Gets the next bill number for the current fiscal year; stock drops at the store; appears on the dashboard | ☐ |
| PV-14 | Bill numbering: compare the new bill number with the highest of the current fiscal year | Continues without gap or clash (see D1) | ☐ |
| PV-15 | Return an item from an old sale | Return recorded; stock back; eligible-qty rules respected | ☐ |
| PV-16 | Edit and delete a recent saved sale | Works; totals recalculate | ☐ |
| PV-17 | Deliveries (008/009): old sales with delivery data open; book a delivery, assign a partner, confirm delivery | Old delivery rows intact; new fields (method, courier, collection status) work | ☐ |
| PV-18 | Acting user (018): create a sale as Store Head on behalf of staff | Both users recorded | ☐ |

## 4. Stock and inventory (migrations 019, 029, 030, 031, 035)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-20 | Stock screen: search 10 products (incl. fast movers, negative ones); compare available quantity and batch list with live | Identical (PV-03 at row level) | ☐ |
| PV-21 | Store stock (029): all existing stock sits at the main store | Quantity at store = total quantity | ☐ |
| PV-22 | Quantity adjustment with each reason code (031) | Saved; small ones auto-approve, high-value ones wait for approval | ☐ |
| PV-23 | Approve and reject a pending adjustment (019) | Stock changes only on approval; audit trail shows who | ☐ |
| PV-24 | Bin location (030): set and edit on a product; search by it | Saved and findable | ☐ |
| PV-25 | Cycle count (035): count a few products, including one with a variance | Variance goes to approval; no change when count equals book | ☐ |
| PV-26 | Near-expiry list and return-to-vendor | Expiring batches listed; return reduces stock | ☐ |
| PV-27 | Inter-store transfer: needs a second store, so create "Store B" first | Transfer out/in correct per store; cancel works | ☐ |

## 5. Purchases, payables and planning (migrations 010, 011, 012, 013, 026)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-30 | Purchase list: compare old invoices (dates, vendors, totals) with live | Same; list loads quickly with 1,739 invoices | ☐ |
| PV-31 | **Payables screen (D4)**: look at the outstanding total and overdue list | Currently all ₹76,19,110 show as unpaid and overdue. Confirm this is wrong for history and apply the chosen rule | ☐ |
| PV-32 | Record a payment against a recent invoice; then a partial payment | Status goes Unpaid → Partial → Paid; balance correct | ☐ |
| PV-33 | Pay run across several invoices (026) | One payment split across invoices; reversal creates an audit trail | ☐ |
| PV-34 | Vendor payment terms (026): set 30 days, create an invoice | Due date = invoice date + terms | ☐ |
| PV-35 | Purchase planning (012): suggestions list, raise a purchase request, convert to an order | Request → order link works; fulfilled quantity updates on receipt | ☐ |
| PV-36 | PO approval (013): raise an order above the threshold with a non-privileged user, then approve as Store Head | Held for approval; approve and reject both work (`app_setting` read) | ☐ |
| PV-37 | Create and receive an invoice; check GRN number (007) | GRN unique, increasing; stock added at the right store | ☐ |

## 6. Shifts and cash (migrations 014, 015, 024, 025, 032, 033, 034). New feature, no history

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-40 | Open a shift as Sales Staff with a denomination count | Shift OPEN; sales can be billed | ☐ |
| PV-41 | Try billing with no open shift | Blocked with a clear message | ☐ |
| PV-42 | Close the shift: counted cash vs expected; variance shown | Variance computed from the shift's cash sales | ☐ |
| PV-43 | Cash threshold (015): exceed the store deposit threshold | Deposit prompt/flag appears | ☐ |
| PV-44 | Record a bank deposit with a reference (032) and a categorised expense (033) | Both listed in the cash ledger | ☐ |
| PV-45 | Checklist (034) on open and close | Items saved with the shift | ☐ |

## 7. GST (migrations 027, 028)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-50 | `business.gstin` is empty after migration (checked) | Enter the real GSTIN, legal name, state, address in the business settings | ☐ |
| PV-51 | Old purchase invoices: GST fields (supplier GSTIN, place of supply, tax split) | Show blank/defaults; confirm that is acceptable and decide whether to backfill | ☐ |
| PV-52 | New purchase invoice with GST details | Saved; header split sums to total | ☐ |
| PV-53 | GSTR-2A/2B import and reconcile | Matches, mismatches and missing rows classified; period lock works | ☐ |
| PV-54 | GST sales and returns reports for a past month | Same figures as the live app for that month | ☐ |

## 8. Users, roles and permissions (migrations 016, 022, 023, 025, 037; see D3)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-60 | Log in as each of the six users and record the menu each sees | Each role sees what it should; nothing bounces to login | ☐ |
| PV-61 | Open Settings → Roles, Users, Stores, Notifications as admin | After the roles fix all open; before it, Notifications and Stores are denied (expected for now) | ☐ |
| PV-62 | Custom or edited roles: compare the old permission JSON with the new one | No screen the role used before disappears | ☐ |
| PV-63 | User-to-store assignment (016): assign a user to the store | Store switcher shows only assigned stores | ☐ |
| PV-64 | Business scope (022): users 1, 6 and 8 have business 1 | Business-level data scoping works | ☐ |
| PV-65 | Login for a deactivated user; change password | Blocked; password change works | ☐ |

## 9. Notifications (migrations 036, 037)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-70 | Daily digest preview for a recent date | Real sales/purchase figures; no cash or margin | ☐ |
| PV-71 | Send to the Telegram group with Resend ticked | Message arrives, figures equal the preview | ☐ |
| PV-72 | Non-admin role calls the notifications API | 403 | ☐ |

## 10. Reports, dashboard and performance (migrations 001, 003–006, 021)

| ID | Steps | Expected | Result |
|---|---|---|---|
| PV-80 | Dashboard (store and all-store views) | Totals equal PV-02 for the period; no errors | ☐ |
| PV-81 | Run each report for a month and a full year; compare with live for the same period | Numbers identical | ☐ |
| PV-82 | Time the heaviest screens with 62k sales: sales list, stock, customer visits, purchase list | Each loads in a few seconds; note anything slower than live | ☐ |
| PV-83 | API log during the run: warnings or errors | None unexplained | ☐ |

## 11. Sign-off

Cutover goes ahead only when:
- D1, D2 and D3 are fixed in the migration set and the whole upgrade re-runs clean from a fresh dump,
- every item in §2 passes, and any failures in §3–§10 are fixed or consciously accepted,
- D4 (payables opening balance) and D6 (uploads) have a decision,
- a final rehearsal on a dump taken shortly before cutover repeats the pass.

Record findings in a table below as you go: ID, what you saw, severity, decision.

| ID | Finding | Severity | Decision |
|---|---|---|---|
| | | | |
