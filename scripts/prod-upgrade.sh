#!/usr/bin/env bash
# Upgrade a production (branch v2, migrations 001,003-007) database to the current schema.
#
#   rehearse <dump>   restore a pg_dump -Fc into a scratch database and run the full upgrade on it
#   cutover           run the same upgrade in place on the live database (backup + safety checks first)
#   verify            print the invariants for a database (no changes)
#   report <outdir>   write the review lists (sql/prod-upgrade/reports) as CSV files, read-only
#   load-vendors <csv>  load a filled-in vendor sheet (GSTIN, payment terms, phone); add --fixes-dry-run to rehearse it
#
# Both modes run identical steps: pre-snapshot -> migrations -> optional opening payables -> post-check
# that history is unchanged. Applied files are recorded in schema_migrations, so a re-run only applies
# what is missing.
#
# Where Postgres lives is configured by environment, so the same script works locally and on the VPS:
#   PG_PREFIX   command that runs a binary next to the database, e.g. "docker exec -i rgp-db-dev"
#               (default empty = psql/pg_dump on PATH)
#   PGUSER      database user                         (default rgpapp)
#   PGDATABASE  target database for cutover/verify    (default rgpdb)
#   For direct (non-docker) connections also set PGHOST / PGPORT / PGPASSWORD as usual.
#
# Options:
#   --skip-fixes          do not run the data fixes (sql/prod-upgrade/fixes)
#   --fixes-dry-run       run the fixes and the vendor load in report-only mode (nothing is written)
#   --approve "01 03"     fixes marked "approval: required" run only when listed here (they change stock numbers)
#   --writeoff-days N     expiry write-off: only batches expired more than N days ago (default 180)
#   --cutoff YYYY-MM-DD   also settle COMPLETE purchase invoices dated before this (sql/prod-upgrade/opening_payables.sql)
#   --assume-applied "001 003 ..."   migrations already on the target (default: 001 003 004 005 006 007)
#   --scratch NAME        rehearse: scratch database name (default rgp_rehearsal)
#   --backup-dir DIR      cutover: where the pre-upgrade backup goes (default ./backups)
#   --force               cutover: proceed although other sessions are connected
#   --yes                 cutover: skip the typed confirmation
set -euo pipefail
export MSYS_NO_PATHCONV=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG="$ROOT/sql/migrations"
PG_PREFIX="${PG_PREFIX:-}"
PGUSER="${PGUSER:-rgpapp}"
PGDATABASE="${PGDATABASE:-rgpdb}"
export PGUSER

mode="${1:-}"; shift || true
dump=""; cutoff=""; scratch="rgp_rehearsal"; backup_dir="$ROOT/backups"; force=0; yes=0
assume="001 003 004 005 006 007"
skip_fixes=0; fixes_dry=0; approve=""; writeoff_days=180; arg1=""
if [ "$mode" = "rehearse" ]; then dump="${1:-}"; shift || true; fi
if [ "$mode" = "report" ] || [ "$mode" = "load-vendors" ]; then arg1="${1:-}"; shift || true; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --cutoff) cutoff="$2"; shift 2;;
    --assume-applied) assume="$2"; shift 2;;
    --scratch) scratch="$2"; shift 2;;
    --backup-dir) backup_dir="$2"; shift 2;;
    --skip-fixes) skip_fixes=1; shift;;
    --fixes-dry-run) fixes_dry=1; shift;;
    --approve) approve="$2"; shift 2;;
    --writeoff-days) writeoff_days="$2"; shift 2;;
    --force) force=1; shift;;
    --yes) yes=1; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done

psql_db() { local db="$1"; shift; $PG_PREFIX psql -U "$PGUSER" -d "$db" -v ON_ERROR_STOP=1 -X -q "$@"; }
scalar()  { local db="$1"; shift; psql_db "$db" -At -c "$1"; }
say()     { printf '\n== %s\n' "$*"; }
die()     { echo "ERROR: $*" >&2; exit 1; }

# One line per invariant; identical output before and after means history was not touched.
snapshot() {
  psql_db "$1" -At -F '|' <<'SQL'
select 'sales', count(*), round(coalesce(sum(total),0)::numeric,2) from sale;
select 'sale_items', count(*), 0 from sale_item;
select 'purchase_invoices', count(*), round(coalesce(sum(total),0)::numeric,2) from purchase_invoice;
select 'purchase_items', count(*), 0 from purchase_invoice_item;
select 'customers', count(*), 0 from customer;
select 'products', count(*), 0 from product;
select 'vendors', count(*), 0 from vendor;
select 'users', count(*), 0 from app_user;
select 'sales_'||y, n, t from (select extract(year from bill_date)::int y, count(*) n, round(sum(total)::numeric,2) t from sale group by 1 order by 1) z;
SQL
}

# stock_view only exists in the expected shape; skip quietly if the column names differ.
stock_snapshot() {
  psql_db "$1" -At -F '|' -c "select 'stock_batches', count(*), 0 from stock_view" 2>/dev/null || true
}

ensure_tracking() {
  local db="$1"
  psql_db "$db" -c "create table if not exists schema_migrations (name text primary key, applied_on timestamptz not null default now(), note text)"
  for n in $assume; do
    local f; f=$(ls "$MIG"/${n}_*.sql 2>/dev/null | grep -v rollback | head -1 || true)
    [ -n "$f" ] || continue
    psql_db "$db" -c "insert into schema_migrations(name, note) values ('$(basename "$f" .sql)', 'assumed present on target') on conflict do nothing"
  done
}

migration_files() {
  # numbered forward migrations in order; "001_*" helper docs and rollbacks excluded
  ls "$MIG"/*.sql | grep -vE 'rollback|analysis' | sort
}

apply_migrations() {
  local db="$1" applied=0
  for f in $(migration_files); do
    local name; name=$(basename "$f" .sql)
    if [ "$(scalar "$db" "select count(*) from schema_migrations where name='$name'")" != "0" ]; then continue; fi
    printf '  applying %s ... ' "$name"
    local t0=$SECONDS
    if ! { echo "set client_min_messages=warning;"; cat "$f"; } | psql_db "$db" -o /dev/null; then
      echo FAILED; die "$name failed; the database is left as-is (each file runs in its own transaction where it has one). Fix and re-run: applied files are skipped."
    fi
    psql_db "$db" -c "insert into schema_migrations(name) values ('$name')"
    echo "ok ($((SECONDS-t0))s)"; applied=$((applied+1))
  done
  echo "  $applied migration(s) applied"
}

# Data fixes, in file order. Each file is safe to re-run. A file whose first line is "-- approval: required"
# changes numbers people rely on (stock), so it is skipped unless its number is listed in --approve.
apply_fixes() {
  local db="$1" f n out
  [ "$skip_fixes" = 1 ] && { echo "  (--skip-fixes)"; return; }
  [ "$fixes_dry" = 1 ] && echo "  (dry run: nothing is written)"
  for f in "$ROOT"/sql/prod-upgrade/fixes/[0-9][0-9]_*.sql; do
    [ -f "$f" ] || continue
    n=$(basename "$f" | cut -c1-2)
    if head -1 "$f" | grep -q "approval: required" && ! echo " $approve " | grep -q " $n "; then
      echo "  SKIPPED $(basename "$f") (needs --approve $n)"; continue
    fi
    out=$(psql_db "$db" -v dry_run="$fixes_dry" -v older_than_days="$writeoff_days" < "$f" 2>&1) \
      || { echo "$out" | sed 's/^/  /'; die "fix $(basename "$f") failed; nothing after it was applied."; }
    echo "$out" | { grep -E '^(FIX|ERROR)' || true; } | sed 's/^/  /'
  done
}

settle_payables() {
  local db="$1"
  [ -n "$cutoff" ] || { echo "  (no --cutoff: purchase invoices stay Unpaid; see decision D4)"; return; }
  psql_db "$db" -v cutoff="$cutoff" < "$ROOT/sql/prod-upgrade/opening_payables.sql"
}

post_checks() {
  local db="$1" before="$2" fail=0
  local after; after="$(snapshot "$db"; stock_snapshot "$db")"
  if [ "$before" = "$after" ]; then echo "  history unchanged: sales, items, purchases, customers, products, stock all match"
  else echo "  MISMATCH between before and after:"; diff <(echo "$before") <(echo "$after") || true; fail=1; fi
  local n
  n=$(scalar "$db" "select count(*) from sale where store_id is null"); [ "$n" = "0" ] || { echo "  $n sale rows have no store_id"; fail=1; }
  n=$(scalar "$db" "select count(*) from purchase_invoice where store_id is null"); [ "$n" = "0" ] || { echo "  $n purchase invoices have no store_id"; fail=1; }
  n=$(scalar "$db" "select (select last_value from sale_id_seq) - (select max(id) from sale)"); [ "$n" -ge 0 ] || { echo "  sale_id_seq behind max(sale.id)"; fail=1; }
  n=$(scalar "$db" "select count(*) from app_role where name in ('Business Head','Site Admin')"); [ "$n" = "2" ] || { echo "  roles Business Head / Site Admin missing"; fail=1; }
  n=$(scalar "$db" "select count(*) from stores"); [ "$n" -ge 1 ] || { echo "  no store exists"; fail=1; }
  echo "  stores: $(scalar "$db" "select string_agg(location, ', ') from stores")"
  echo "  roles:  $(scalar "$db" "select string_agg(name, ', ' order by id) from app_role")"
  echo "  payables: $(scalar "$db" "select count(*) filter (where p.invoice_id is null)||' open, '||count(*) filter (where p.invoice_id is not null)||' settled' from purchase_invoice i left join (select distinct invoice_id from vendor_payment) p on p.invoice_id=i.id where i.status='COMPLETE'")"
  [ "$fail" = 0 ] && echo "RESULT: PASS" || { echo "RESULT: FAIL"; return 1; }
}

run_upgrade() {
  local db="$1"
  say "snapshot before"
  local before; before="$(snapshot "$db"; stock_snapshot "$db")"
  echo "$before" | sed 's/^/  /' | head -12
  say "migrations"; ensure_tracking "$db"; apply_migrations "$db"
  say "fixes"; apply_fixes "$db"
  say "opening payables"; settle_payables "$db"
  say "checks"; post_checks "$db" "$before"
}

case "$mode" in
  rehearse)
    [ -f "$dump" ] || die "usage: $0 rehearse <pg_dump -Fc file> [options]"
    say "restoring $(basename "$dump") into scratch database $scratch"
    $PG_PREFIX psql -U "$PGUSER" -d postgres -X -q -c "drop database if exists \"$scratch\"" -c "create database \"$scratch\""
    $PG_PREFIX pg_restore -U "$PGUSER" -d "$scratch" --no-owner --no-privileges < "$dump" || echo "  (pg_restore reported warnings; continuing)"
    start=$SECONDS
    run_upgrade "$scratch"
    echo; echo "Rehearsal took $((SECONDS-start))s. Point the dev API at it with POSTGRES_DB=$scratch."
    ;;
  cutover)
    say "target: $PGDATABASE as $PGUSER (LIVE)"
    others=$(scalar "$PGDATABASE" "select count(*) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()")
    if [ "$others" != "0" ] && [ "$force" != 1 ]; then
      scalar "$PGDATABASE" "select application_name||' '||coalesce(client_addr::text,'local') from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()" | sed 's/^/  connected: /'
      die "$others other session(s) connected. Stop the old API first (or --force)."
    fi
    if [ "$yes" != 1 ]; then
      echo "  Reminder: an idle API holds no connections, so the check above cannot prove the OLD app is stopped."
      echo "  Stop it (docker compose stop api frontend) before continuing."
      read -r -p "Old app stopped. Back up and upgrade LIVE database '$PGDATABASE'? Type its name to continue: " ans
      [ "$ans" = "$PGDATABASE" ] || die "aborted"
    fi
    mkdir -p "$backup_dir"
    bak="$backup_dir/${PGDATABASE}_pre-upgrade_$(date +%Y%m%d_%H%M%S).dump"
    say "backup -> $bak"
    $PG_PREFIX pg_dump -U "$PGUSER" -Fc "$PGDATABASE" > "$bak"
    [ -s "$bak" ] || die "backup is empty"
    $PG_PREFIX pg_restore -l < "$bak" >/dev/null || die "backup is unreadable"
    echo "  $(du -h "$bak" | cut -f1) written and readable"
    start=$SECONDS
    run_upgrade "$PGDATABASE" || { echo "Upgrade failed checks. Roll back: restore $bak and restart the old app."; exit 1; }
    echo; echo "Cutover took $((SECONDS-start))s. Backup: $bak. Now start the new API."
    ;;
  verify)
    snapshot "$PGDATABASE"; stock_snapshot "$PGDATABASE"
    ;;
  report)
    [ -n "$arg1" ] || die "usage: $0 report <output dir>   (the files contain customer data: keep the folder outside the repo)"
    mkdir -p "$arg1"
    for f in "$ROOT"/sql/prod-upgrade/reports/*.sql; do
      name=$(basename "$f" .sql)
      body=$(grep -v '^--' "$f" | sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}')
      echo "COPY ($body) TO STDOUT WITH CSV HEADER" | psql_db "$PGDATABASE" > "$arg1/$name.csv"
      printf '  %-28s %s rows\n' "$name.csv" "$(( $(wc -l < "$arg1/$name.csv") - 1 ))"
    done
    ;;
  load-vendors)
    [ -f "$arg1" ] || die "usage: $0 load-vendors <csv from reports/vendor_sheet.csv> [--fixes-dry-run]"
    { echo "begin;"
      echo "create temp table _v_in (vendor_id int, business_name text, gstn text, payment_terms_days text, contact_phone text, invoices text, purchased_last_12_months text);"
      echo "copy _v_in from stdin with (format csv, header true);"
      tr -d '\r' < "$arg1"
      echo '\.'
      cat "$ROOT/sql/prod-upgrade/sheets/load_vendors.sql"
    } | psql_db "$PGDATABASE" -v dry_run="$fixes_dry" 2>&1 | { grep -E '^(LOAD|ERROR)|invalid_gstin|^ *[0-9]+ \|' || true; }
    [ "${PIPESTATUS[1]}" = 0 ] || die "vendor load failed; nothing was changed."
    ;;
  *) sed -n '2,29p' "$0"; exit 2;;
esac
