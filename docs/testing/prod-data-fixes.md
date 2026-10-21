# Production data fixes - register

Everything found in the live-database copy (dump of 2026-10, 61,847 sales, 1,739 purchase invoices) that should be fixed, decided or accepted before or at cutover. Counts are from the rehearsal database, active records only unless stated.

**Who:** *You* = needs your decision or information. *Me* = I can script it (dry-run first, history untouched). *Both* = I prepare, you confirm.

## A. Fix or decide before cutover

| # | Area | What is wrong | Size | Why it matters | Proposed fix | Who |
|---|---|---|---|---|---|---|
| 1 | Payables | Prod never recorded a vendor payment, so every invoice shows Unpaid and Overdue. All 23 vendors have 0-day terms | 1,714 invoices, Rs 74.9 lakh show unpaid | Payables and overdue screens are meaningless | Opening payments before a cutoff (rule: cutover date minus 45 days, provisional 2026-09-15 leaves 35 invoices, Rs 1.34 lakh open). Script ready: `sql/prod-upgrade/opening_payables.sql` | Both: check the 7 open vendors against statements |
| 2 | **Opening stock** | Purchases entered cover only about half of what was sold, so the books say there is almost no stock. Purchases entered in the last 12 months: Rs 13.4 lakh; sales in the same period: Rs 32.3 lakh | 1,173 of 15,944 batches and **559 products are negative** (net -2.79 lakh units); only 1,363 batches show stock (Rs 2.58 lakh at cost). 164 of the 770 products sold in the last 90 days (about 12% of revenue) have no sellable stock on the books | The new POS offers only batches with stock on the books, so those products cannot be billed until stock is received or counted in. The old POS read `stock_view`, which ignored sales, so it never ran out | **Physical stock count at cutover**, posted with `prod-upgrade.sh load-opening-stock` (built and tested: see the runbook). The in-app stock count cannot do it, it only lists batches that already have a positive balance. `opening_stock_sheet.csv` is the count sheet; `negative_stock_products.csv` lists the busiest gaps first | You (count), Me (load) |
| 3 | Stock | Expired stock still on the books (correct basis) | 209 batches, 21,686 units, Rs 61,730 at cost. 141 of them expired more than 180 days ago (Rs 47,978) | Overstates stock slightly; expired items could be offered | Fix 03 writes off the 141 (approval-gated, dry run first); the 68 expired in the last 180 days are checked on the shelf | You approve, Me script |
| 4 | Business | GSTIN, legal name, state code, address, pincode are blank. Business renamed to Ramesh Generic Pharmacy | 1 business | GST invoices and reconciliation need them | Enter in Settings > Businesses | You |
| 5 | Store | Store created as placeholder "Main Store" | 1 store | Shows on bills and reports | Rename and fill address in Settings > Store | You |
| 6 | Vendors | No GSTIN, plus one malformed: MEDPLUS `33AAAC07727M1Z6` (a digit where the PAN needs a letter, probably a typo) | 18 of 23 missing, 1 malformed | GST 2A/2B reconciliation and ITC cannot match without it | Fill `vendor_sheet.csv` from vendor invoices and load it with `prod-upgrade.sh load-vendors` (GSTIN, registration type, legal name, contacts, sales rep, terms, credit limit, discount, bank, wholesale drug licence and its end date). The same fields are on the Vendors screen (migration 043); a malformed GSTIN is refused in both | You |
| 7 | Vendors | Payment terms 0 days for all | 23 | Due dates equal invoice dates, so everything is overdue the day it is entered | Same sheet as item 6 | You |
| 8 | Users | One shared login: 22,815 of ~28,800 completed sales are under `lakshman`. History has no acting user | all history | Staff sales and audit only become meaningful with a login per person | Each person signs in as themselves from cutover; confirm the user list | You |
| 9 | Users | `purushoth@rgp.com` to retire; Site Admin `siteadmin@rgp.com` to create; scratch password rgp@123 must not reach prod | 2 users | Security | `sql/prod-upgrade/users.sql` with a strong password passed as a hash | Both |
| 10 | Uploads | The `upload/` folder (prescriptions, documents) is not in the dump | unknown | Document links would break | Check the VPS and copy the folder | You |

## B. Data hygiene (scriptable, history untouched)

| # | Area | What is wrong | Size | Proposed fix | Who |
|---|---|---|---|---|---|
| 11 | Products | No HSN code | 1,934 of 1,963 | HSN summary in GSTR-1 needs it. Fill from a category-to-HSN list or an import sheet | Both |
| 12 | Products | No tax percentage | 882 | Fill from HSN or category defaults | Both |
| 13 | Products | No category (drives customer buying-pattern and reports) | 295 | Assign by title rules, review the list | Both |
| 14 | Products | Chronic flag not set (blank or missing); the chronic-mobile rule and refill list treat these as not chronic | 1,258 of 3,469 (535 marked chronic, 497 marked not) | Review `chronic_candidates.csv`: 87 products bought repeatedly by the same customers (e.g. NIVABION FORTE, NEUROVITT, BYCALVIT, PARACIP). Mark y/n and I apply | You review, Me apply |
| 15 | Products | No manufacturer | 669 | Optional; fill over time | You |
| 16 | Customers | Same mobile number on several customer records | 102 numbers, 228 records | Merge duplicates (review list first). Affects refill follow-up and history per customer | Both |
| 17 | Customers | No mobile / odd mobile / no name. The 265 with no mobile are 258 empty strings and 7 NULL. Odd mobiles: 17 (text such as HAND BILL, test digits such as 1234567890 and 1111111111, a short number, a foreign number). The NIL walk-in customer 0000000000 is deliberate and stays | 265 / 17 / 10 | Fix 04 turns empty strings into NULL, strips formatting (+91, spaces, a leading 0) and clears text-only mobiles, logging every change in `customer_data_fix_log`. The rest need a person: `customer_mobile_review.csv` lists them, busiest first. Collect missing numbers at the next purchase (chronic bills require it) | Me (04), You (review list) |
| 18 | Sales | Completed bills with no line items | 312 bills, Rs 29,903 (2022-2026) | Probably incomplete saves. Decide: keep as revenue, or mark void | You |
| 19 | Sales | Completed bills with zero or negative total (e.g. -Rs 424 in Mar 2022) | 14 | Likely old credit notes. Keep; list for review | You |
| 20 | Sales | Completed bills with no customer | 4 | Point to the NIL customer | Me |
| 21 | Sales | Sale lines with quantity 0 or less | 2 | Review and remove | Both |
| 22 | Purchases | Draft invoices (status NEW). Outstanding, Payables and the invoice list now treat a draft as not received, so it is no longer counted as owed and cannot be offered for payment; drafts show under their own Drafts chip. They are still worth clearing | 25, Rs 1.28 lakh; 11 for Karthikeyan Drug House, oldest Nov 2024 | Complete or delete the stale ones, or decide that drafts should not count as owed | You |
| 23 | Purchases | Invoice lines not VERIFIED | 3 | Verify or remove | Both |
| 24 | Vendors | No phone | 18 | Fill over time | You |

## C. Known and accepted (no action, recorded for the record)

| # | What | Notes |
|---|---|---|
| 25 | Bill numbers restart every 1 January, with legacy duplicates (2022 about 1,537, 2024 about 2,388) | Decided to keep; first bill of 2027 should be 1 |
| 26 | Roles reset to the standard permissions (prod Store Head could manage users, roles and payroll) | Confirm with the owner |
| 27 | HR / payroll / KPI tables from the `main` line (small data) | Kept as is for now (decision D5 open) |
| 28 | About 11% of revenue is on products with no category | Reduced by item 13 |

## How fixes reach prod

Nothing done by hand in a rehearsal copy carries over. Everything is replayed on a fresh prod dump at cutover:
`scripts/prod-upgrade.sh` runs migrations, then the fixes in `sql/prod-upgrade/fixes/` (safe to re-run; those marked
`approval: required` are skipped unless listed in `--approve`), then the payables opening, then the checks.
`prod-upgrade.sh report <dir>` writes the review lists as CSV (customer data: keep outside the repo) and
`prod-upgrade.sh load-vendors <csv>` loads the filled vendor sheet. Use `--fixes-dry-run` to see counts without writing.

| Fix | What | Approval |
|---|---|---|
| 01 | Align `stock_view` with the POS stock formula (it ignored sales and subtracted adjustments). Affects the ready-to-sell list, stock-demand report and the single-batch lookup, not the POS | required |
| 02 | Attach the 4 completed bills with no customer to the NIL customer | no |
| 03 | Write off batches expired more than 180 days ago (141 batches, Rs 47,978) | required |
| 04 | Customer mobiles, safe part only: 258 empty strings become NULL, formatted numbers become 10 digits (none in the current dump), 3 text-only mobiles become NULL; old values kept in `customer_data_fix_log`. Rehearsed on a fresh dump: PASS | no |
| 05 | Customer names: stray spaces trimmed (2,244 had a leading or trailing space), and names written all in capitals or all in lower case become Title Case (3,282 of 3,355 were capitals). Mixed-case names keep their capitals, the NIL walk-in is skipped, and any change that would clash on name + mobile is skipped. Old values kept in `customer_data_fix_log`. The API applies the same rule to new entries | no |

## Suggested order

1. Decisions only you can make: #1 vendors check, #2 stock count plan, #3 expiry write-off, #18 item-less bills, #22 drafts.
2. Information only you have: #4, #5, #6, #7, #10, #8.
3. I script and dry-run: #14 apply your y/n list, #16 duplicate merges from your reviewed list, #11-13 fill proposals. Fix 02 (#20) is already scripted.
4. Everything is rehearsed on a fresh dump before cutover. The stock count (#2) should be done before or on cutover day, because it decides what the POS can sell.
