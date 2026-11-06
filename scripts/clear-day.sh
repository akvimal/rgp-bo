#!/usr/bin/env bash
# Clear one day's shifts, vault entries and (optionally) recorded expenses, e.g. after a wrong vault opening or shift opening.
#
#   clear-day.sh show  [--date YYYY-MM-DD] [--store N]               list what exists (no changes)
#   clear-day.sh clear [--date YYYY-MM-DD] [--store N] [--expenses]  back up, preview, ask, then delete in ONE transaction
#
# --date      the day (default: today in India time)
# --store N   only this store (default: every store)
# --expenses  also delete the Expenses-module records of that day (the `expense` table). Cash taken from the drawer for an
#             expense is a cash-book row on the shift, and goes with the shift either way.
# --yes       skip the typed confirmation
# --no-backup skip the pg_dump
#
# Refuses when bills were rung on the shifts (void or move them first). All-or-nothing: any error rolls everything back.
#
# Where Postgres lives is set by environment, as in prod-upgrade.sh:
#   PG_PREFIX   e.g. "docker exec -i rgp-db"   (default empty = psql on PATH)
#   PGUSER (default rgpapp)   PGDATABASE (default rgpdb)
set -euo pipefail
export MSYS_NO_PATHCONV=1

PG_PREFIX="${PG_PREFIX:-}"
PGUSER="${PGUSER:-rgpapp}"
PGDATABASE="${PGDATABASE:-rgpdb}"
export PGUSER

mode="${1:-show}"; shift || true
day="$(TZ=Asia/Kolkata date +%F)"; store=0; expenses=0; yes=0; backup=1
while [ $# -gt 0 ]; do
  case "$1" in
    --date) day="$2"; shift 2;;
    --store) store="$2"; shift 2;;
    --expenses) expenses=1; shift;;
    --yes) yes=1; shift;;
    --no-backup) backup=0; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
[[ "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--date must be YYYY-MM-DD" >&2; exit 2; }
[[ "$store" =~ ^[0-9]+$ ]] || { echo "--store must be a number" >&2; exit 2; }
[ "$mode" = "show" ] || [ "$mode" = "clear" ] || { echo "usage: $0 show|clear [--date D] [--store N] [--expenses]" >&2; exit 2; }

psqlq() { $PG_PREFIX psql -q -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -v d="$day" -v store="$store" -v exp="$expenses" "$@"; }

# the rows in scope, shared by every query below (store 0 = all stores)
SCOPE="
create temp table clr as select id from store_shifts where shift_date = :'d'::date and (:store = 0 or store_id = :store);
create temp table clr_vm as select id from store_vault_movements
 where (shift_id in (select id from clr) or (created_on at time zone 'Asia/Kolkata')::date = :'d'::date) and (:store = 0 or store_id = :store);
"

show_sql="$SCOPE
\\echo == shifts
select id, store_id, name, status, opening_cash, opened_on from store_shifts where id in (select id from clr) order by id;
\\echo == vault movements
select id, store_id, move_type, direction, amount, status, shift_id from store_vault_movements where id in (select id from clr_vm) order by id;
\\echo == cash book rows (on those shifts, or behind those vault movements, or dated that day)
select id, store_id, category, description, deposit, withdraw, shift_id, holder from store_cash_accounts
 where (shift_id in (select id from clr) or vault_movement_id in (select id from clr_vm) or (trans_date = :'d'::date and (:store = 0 or store_id = :store))) order by id;
\\echo == expenses (Expenses module) that day
select id, store_id, amount, pay_mode, status, payee, description from expense where expense_date = :'d'::date and (:store = 0 or store_id = :store) order by id;
\\echo == bills on those shifts (must be 0 to clear)
select count(*) as bills from sale where shift_id in (select id from clr);
"

if [ "$mode" = "show" ]; then
  echo "$show_sql" | psqlq
  exit 0
fi

# ---- clear
bills="$(echo "$SCOPE select count(*) from sale where shift_id in (select id from clr); select count(*) from customer_due_entry where shift_id in (select id from clr);" | psqlq -At | tail -2 | tr '\n' ' ')"
set -- $bills
if [ "${1:-0}" != "0" ] || [ "${2:-0}" != "0" ]; then
  echo "Refusing: ${1:-0} bill(s) and ${2:-0} customer payment(s) were recorded on these shifts. Void or move them first." >&2
  exit 1
fi

echo "About to delete, for $day$([ "$store" != 0 ] && echo " store $store" || echo " (all stores)"):"
echo "$show_sql" | psqlq
[ "$expenses" = 1 ] && echo ">> the expenses listed above WILL be deleted" || echo ">> expenses (Expenses module) will be kept; pass --expenses to delete them"

if [ "$backup" = 1 ]; then
  out="${HOME:-.}/before_clear_${day}_$(date +%H%M%S).sql.gz"
  echo "Backing up to $out ..."
  $PG_PREFIX pg_dump -U "$PGUSER" "$PGDATABASE" | gzip > "$out"
  echo "backup written ($(du -h "$out" | cut -f1))"
fi

if [ "$yes" != 1 ]; then
  read -r -p "Type the date ($day) to delete it all: " typed
  [ "$typed" = "$day" ] || { echo "Not confirmed. Nothing changed."; exit 1; }
fi

echo "
begin;
$SCOPE
delete from store_cash_accounts where shift_id in (select id from clr) or vault_movement_id in (select id from clr_vm);
delete from store_vault_movements where id in (select id from clr_vm);
delete from store_vault_counts where (counted_on at time zone 'Asia/Kolkata')::date = :'d'::date and (:store = 0 or store_id = :store);
update store_shifts set handover_from_shift_id = null where handover_from_shift_id in (select id from clr);
delete from shift_checklist_log where shift_id in (select id from clr);
delete from store_shifts where id in (select id from clr);
delete from expense where :exp = 1 and expense_date = :'d'::date and (:store = 0 or store_id = :store);
select (select count(*) from store_shifts where id in (select id from clr)) as shifts_left,
       (select count(*) from store_vault_movements where id in (select id from clr_vm)) as vault_moves_left;
commit;
" | psqlq

echo "Done. The vault and shifts for $day are cleared."
