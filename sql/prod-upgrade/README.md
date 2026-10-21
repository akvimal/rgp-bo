# Production upgrade (v2 -> current)

Script: `scripts/prod-upgrade.sh`. It records applied files in `schema_migrations`, skips what the target
already has (default `001 003 004 005 006 007`), and checks that sales, items, purchases, customers,
products and stock are unchanged afterwards. Decisions behind the steps: `docs/testing/prod-data-validation-plan.md`.

## 1. Rehearse (as often as you like, any time)

```bash
# fresh dump from the VPS (read-only)
pg_dump -Fc -U <user> <db> > rgp_prod.dump

export PG_PREFIX="docker exec -i rgp-db-dev"      # local; drop on a host with psql installed
scripts/prod-upgrade.sh rehearse rgp_prod.dump --cutoff 2026-08-01
# ~35 s for the current data. Point a dev API at it: POSTGRES_DB=rgp_rehearsal
```

Passwords on a rehearsal copy can be reset freely; never on live.

## 2. Cut over

1. Announce a 15-30 minute window outside shop hours.
2. Stop the old app: `docker compose stop api frontend` (the check for open sessions is only a hint,
   an idle API holds none).
3. `PGDATABASE=<db> scripts/prod-upgrade.sh cutover --cutoff <date>`
   - asks you to type the database name, writes `backups/<db>_pre-upgrade_<time>.dump` and verifies it can be read,
     runs every missing migration, then the checks. Ends with `RESULT: PASS` or `FAIL`.
4. Start the new API and frontend, smoke-test: log in, open a sale, a purchase list, Settings -> Notifications.
5. Keep the backup and the old images for about a week.

**Rollback:** restore the backup (`pg_restore --clean --if-exists -d <db> <dump>`) and start the old app.
Entries made after the backup are lost, which is why the old app must be stopped first.

## Before the real cutover, settle

- D4 cutoff date for `opening_payables` (or pass none to leave everything Unpaid)
- bill-number reset: 1 Jan (as today) or 1 Apr
- D5 HR tables, D6 `upload/` folder copy, D7 negative-stock batches
- rename "Main Store" to the real name (Settings -> Store); assign users to stores as needed

## Data fixes, review lists and sheets

Fixes done by hand on a rehearsal copy do not carry to prod. Anything that must happen at cutover is a file here
and is replayed on a fresh dump. See `docs/testing/prod-data-fixes.md` for what each one is for.

```bash
# fixes run automatically after the migrations; some need an explicit OK because they change stock numbers
scripts/prod-upgrade.sh rehearse rgp_prod.dump --fixes-dry-run --approve "01 03"   # counts only, nothing written
scripts/prod-upgrade.sh rehearse rgp_prod.dump --approve "01 03" --writeoff-days 180
scripts/prod-upgrade.sh cutover --approve "01 03"

# review lists (CSV, customer data: write them outside the repo)
PGDATABASE=<db> scripts/prod-upgrade.sh report D:/workspace/rgp-migration/reports

# vendor sheet: fill GSTIN / payment terms / phone in vendor_sheet.csv, then
PGDATABASE=<db> scripts/prod-upgrade.sh load-vendors vendor_sheet.csv --fixes-dry-run   # check first
PGDATABASE=<db> scripts/prod-upgrade.sh load-vendors vendor_sheet.csv
```

`fixes/NN_name.sql` run in order and must be safe to run twice. A first line `-- approval: required` makes the runner skip
the file unless `--approve NN` is given. `reports/*.sql` are single read-only SELECTs. `sheets/` hold the loaders.

