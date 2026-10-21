# Production cutover plan

From the live database (branch `v2`, migrations 001 and 003-007) to the current app (migrations 002 to 052). The database is
upgraded in place after a verified backup; the old app stays stopped until the new one is confirmed. Rollback is restoring the backup.
Detail behind each step: `sql/prod-upgrade/README.md` (commands), `docs/testing/prod-data-fixes.md` (what is wrong in the data and why),
`docs/testing/prod-data-validation-plan.md` (checks after cutover).

## 1. Decisions and inputs needed before the date is fixed

| # | Item | Status |
|---|---|---|
| 1 | Payables rule: settle invoices older than cutover date minus 45 days (provisional 2026-09-15). Check the 7 open vendors against statements | rule chosen, statements to check |
| 2 | Approve fix 01 (align `stock_view` with the POS) and fix 03 (write off the 141 batches expired over 180 days, Rs 47,978) | needs your OK |
| 3 | Completed bills with no items (312, Rs 29,903): keep as revenue or void | needs your decision |
| 4 | Stale purchase drafts (25): complete or delete | needs your decision |
| 5 | Business details (GSTIN, legal name, state code, address, pincode) and the real store name | needs your input |
| 6 | Vendor sheet: GSTIN (18 missing, 1 malformed), payment terms, phone | needs your input |
| 7 | One login per person: list of staff and their roles and stores (Store Head / Sales Staff); the shared `lakshman` login stops being used for everyone | needs your input |
| 8 | Who counts the shelf, and whether staff can record the expiry of each batch | needs your input |
| 9 | `UPLOADS_PATH` on the VPS is the same folder as today (a redeploy does not touch it); check the folder exists and has the prescriptions | check on the VPS |
| 10 | Chronic flag on the 87 repeat-purchase candidates (`chronic_candidates.csv`): mark y/n | optional before, can follow |

## 2. Preparation (the week before)

1. **Freeze the code.** Push the branch and tag the commit you rehearse against, for example `prod-2026-11-xx`. Deploy that tag, not a branch.
2. **Rehearse on a fresh dump.** Read-only `pg_dump -Fc` from the VPS, then
   `scripts/prod-upgrade.sh rehearse <dump> --cutoff <date> --approve "01 03"`. It must end with `RESULT: PASS`.
   Run the dry run first (`--fixes-dry-run`), then the real one, then open the app on the rehearsal copy and walk the checks in the validation plan.
3. **Build the lists.** `prod-upgrade.sh report <folder outside the repo>` writes the CSV lists. Hand over:
   `opening_stock_priority.csv` (about 160 products to count during the freeze), `opening_stock_sheet.csv` (full shelf, for the first weeks),
   `vendor_sheet.csv`, `chronic_candidates.csv`, `duplicate_customers.csv`.
4. **Load the vendor sheet in the rehearsal** (`load-vendors <csv> --fixes-dry-run`, then for real) so the real run is no surprise.
5. **Prepare the VPS** (nothing is started yet):
   - `git fetch --tags && git checkout <tag>`
   - tag the images that run today so they can come back: `docker tag <project>-api:latest <project>-api:pre-cutover` (same for `frontend`)
   - `docker compose -f docker-compose.prod.yml build` (the Angular build takes minutes; do it now, not during the freeze)
   - `.env`: nothing new is required. `TELEGRAM_BOT_TOKEN` is optional. Keep `JWT_KEY` and `UPLOADS_PATH` as they are.
   - generate the Site Admin password hash with a strong password: `docker compose exec api node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" '<password>'`
6. **Tell the staff** the window, and that each person signs in as themselves from the next morning.

## 3. Cutover (shop closed)

| Step | Action | About |
|---|---|---|
| 1 | Stop the old app: `docker compose -f docker-compose.prod.yml stop api frontend`. An idle API holds no database connections, so the script cannot prove it is stopped; this step is on you | 2 min |
| 2 | `PGDATABASE=<db> scripts/prod-upgrade.sh cutover --cutoff <date> --approve "01 03"` (type the database name when asked). It writes a backup, checks it can be read, applies migrations, fixes and the payables opening, then the checks | 3 min |
| 3 | **Stop here unless it printed `RESULT: PASS`.** If it did not, restore the backup and start the old app (section 5) | |
| 4 | `psql -f sql/prod-upgrade/users.sql -v siteadmin_hash='<hash>'` (retires `purushoth`, creates `siteadmin@rgp.com`), then `sql/prod-upgrade/business.sql` | 1 min |
| 5 | Load the vendor sheet: `load-vendors <csv> --fixes-dry-run`, then for real | 2 min |
| 6 | Start the new app: `docker compose -f docker-compose.prod.yml up -d` and wait for the health checks | 3 min |
| 7 | **Priority count.** Staff count the roughly 160 products from `opening_stock_priority.csv` on the shelf (strips, loose units, batch, expiry). Then `load-opening-stock <csv> --fixes-dry-run`, fix what it lists, load for real | 1 to 2 hours |
| 8 | Business Head signs in, fills the business details and store name in Settings, creates the personal logins (Settings > Users) with their own strong passwords | 20 min |
| 9 | Smoke test (below) | 20 min |
| 10 | Open the shop | |

Why the priority count sits in the freeze: the new POS offers only batches that have stock on the books. The 160 products that sold in the last
90 days but show none are about 12% of revenue and could not be billed on the first morning. Counting them now, with no sales running, keeps the books equal to the shelf.

**Smoke test.** Sign in as Business Head, Store Head, Sales Staff and Site Admin; each sees only what the role should (Site Admin: no business screens).
Bill one counted product and one ordinary product; a chronic medicine with no mobile number is refused. Dashboard loads; Payables shows the expected open
list; Staff & Quality opens; Notifications loads for the Business Head; a backup is produced.

## 4. After cutover

- **First week:** read the Audit log each morning (failed sign-ins, bills entered on behalf of someone, bill edits). Check the daily backups run and can be restored to a scratch database.
- **Full shelf count, in sections.** Use `opening_stock_sheet.csv` one category at a time, after closing, with no billing during the count, and load it before opening the next morning.
  Never count while the shop is selling: the load sets the books to the counted number, so anything sold after the count would be missed.
- **Then:** apply the reviewed lists (duplicate customers, chronic flags, item-less bills, product master gaps), fill vendor GSTINs as they turn up, run the GST 2A/2B reconciliation once vendors have GSTINs.
- **Keep** the pre-upgrade backup and the `pre-cutover` images for at least two weeks.
- **1 January:** bill numbers restart (as they always have). The first bill of 2027 should be 1.

## 5. Rollback

| When | What to do | Cost |
|---|---|---|
| Step 2 fails, or the check is not `PASS` | `pg_restore --clean --if-exists -d <db> backups/<db>_pre-upgrade_<time>.dump`, then start the old images (`pre-cutover`) | Nothing lost: nothing was sold since the backup |
| Problem found in the smoke test, before opening | Same restore | Nothing lost |
| Problem after the shop has billed in the new app | Do not restore blindly: bills made since the backup would be lost. Fix forward, or export those bills first and restore | Decide with the owner |

## 6. Known limits

- Stock on the books is only as good as the count: the priority list covers what could not be sold, the rest is counted over the first weeks and until then the books may show a product as out when the shelf has it.
- Payables use a business assumption (credit period). Check against the vendor statements.
- Vendors without a GSTIN cannot be matched in GST reconciliation; fill them from invoices as they come.
- The HR / payroll tables from the older `main` line are kept as they are (decision D5 still open).
