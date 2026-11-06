#!/usr/bin/env bash
# Link staff to their business. A user whose business_id is empty (or differs from the business of the stores they work in) cannot be
# edited by their Business Head: the app answers "You can only edit users in your own business".
#
#   fix-user-business.sh show             list the users whose business is empty or differs from the business of their stores
#   fix-user-business.sh fix [--yes]      set business_id from the stores each person works in (backup, preview, confirm, one transaction)
#
# Only a person whose stores all belong to ONE business is changed. Anyone with no store, or stores in several businesses, is listed
# and left alone (a Business Head with no store rows, for example: set theirs by hand). Site Admin logins are never touched.
# --no-backup skips the pg_dump.
#
# Where Postgres lives is set by environment, as in clear-day.sh:
#   PG_PREFIX   e.g. "docker exec -i rgp-db"   PGUSER (default rgpapp)   PGDATABASE (default rgpdb)
set -euo pipefail
export MSYS_NO_PATHCONV=1

PG_PREFIX="${PG_PREFIX:-}"
PGUSER="${PGUSER:-rgpapp}"
PGDATABASE="${PGDATABASE:-rgpdb}"
export PGUSER

mode="${1:-show}"; shift || true
yes=0; backup=1
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) yes=1; shift;;
    --no-backup) backup=0; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
[ "$mode" = "show" ] || [ "$mode" = "fix" ] || { echo "usage: $0 show | fix [--yes] [--no-backup]" >&2; exit 2; }

psqlq() { $PG_PREFIX psql -q -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"; }

# one row per user: the businesses of the stores they work in
SCOPE="
create temp table ub as
  select u.id, u.email, r.name as role, u.business_id as current_business,
         count(distinct s.business_id) as businesses, min(s.business_id) as store_business
    from app_user u
    join app_role r on r.id = u.role_id
    left join user_stores us on us.user_id = u.id and us.active and not us.archive
    left join stores s on s.id = us.store_id
   where u.active and not u.archive and r.name <> 'Site Admin'
   group by u.id, u.email, r.name, u.business_id;
"

LIST="
\\echo == users whose business is empty or differs from the business of their stores
select id, email, role, current_business, store_business, case when businesses = 0 then 'no store: left alone' when businesses > 1 then 'stores in several businesses: left alone' else 'will be set to ' || store_business end as action
  from ub where current_business is distinct from store_business and not (businesses = 0 and current_business is not null) order by id;
"

if [ "$mode" = "show" ]; then
  echo "$SCOPE $LIST" | psqlq
  exit 0
fi

echo "$SCOPE $LIST" | psqlq
n="$(echo "$SCOPE select count(*) from ub where businesses = 1 and current_business is distinct from store_business;" | psqlq -At | tail -1)"
echo "$n user(s) will be updated."
[ "$n" != "0" ] || { echo "Nothing to fix."; exit 0; }

if [ "$backup" = 1 ]; then
  out="${HOME:-.}/before_user_business_$(date +%F_%H%M%S).sql.gz"
  echo "Backing up to $out ..."
  $PG_PREFIX pg_dump -U "$PGUSER" "$PGDATABASE" | gzip > "$out"
fi
if [ "$yes" != 1 ]; then
  read -r -p "Type FIX to apply: " typed
  [ "$typed" = "FIX" ] || { echo "Not confirmed. Nothing changed."; exit 1; }
fi

echo "
begin;
$SCOPE
update app_user u set business_id = ub.store_business, updated_on = now()
  from ub where ub.id = u.id and ub.businesses = 1 and ub.current_business is distinct from ub.store_business;
commit;
" | psqlq
echo "Done. Run '$0 show' to see what is left."
