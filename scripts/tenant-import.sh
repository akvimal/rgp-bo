#!/usr/bin/env bash
# Replaces a hosted customer's (empty) database with a copy of the production data, upgraded to the current schema, so an
# account type can be beta tested with real history. The customer's own database login keeps owning it.
#
#   scripts/tenant-import.sh <name> <prod-dump> [--owner-role "Owner-operator"] [--beta-passwords 'rgp@123'] [--yes]
#
#   <prod-dump>        a pg_dump -Fc of the live database (kept outside the repo: it holds customer data)
#   --owner-role R     give the main admin login (admin@rgp.com) this role in the copy, e.g. Owner-operator for a solo account
#   --beta-passwords P set every login in the COPY to this password so testers can sign in (never use this on live data)
#   --yes              do not ask before the customer's current database is replaced
#
# Runs: stop the customer's app -> restore + upgrade in a scratch database (scripts/prod-upgrade.sh rehearse, the same chain
# the cutover uses) -> swap it in for the customer's database -> start the app again. The customer's current data is lost.
set -euo pipefail
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_WIN="$(cd "$ROOT" && { pwd -W 2>/dev/null || pwd; })"

NAME="${1:?usage: tenant-import.sh <name> <prod-dump> [options]}"; DUMP="${2:?usage: tenant-import.sh <name> <prod-dump> [options]}"; shift 2
OWNER_ROLE=""; BETA_PW=""; YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --owner-role) OWNER_ROLE="$2"; shift 2;;
    --beta-passwords) BETA_PW="$2"; shift 2;;
    --yes) YES=1; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
[ -f "$DUMP" ] || { echo "dump not found: $DUMP" >&2; exit 1; }
[[ "$NAME" =~ ^[a-z][a-z0-9-]{2,29}$ ]] || { echo "bad tenant name" >&2; exit 1; }

DB="rgp_${NAME//-/_}"; ROLE="$DB"; SCRATCH="${DB}_import"
PGC="${PLATFORM_DB_CONTAINER:-rgp-platform-platform-db-1}"
SUPER="${PLATFORM_PG_USER:-rgpplatform}"
pgs() { docker exec -i "$PGC" psql -U "$SUPER" -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

pgs -At -c "select 1 from pg_database where datname = '$DB'" | grep -q 1 || { echo "no database $DB: create the customer in the control plane first" >&2; exit 1; }
if [ "$YES" != 1 ]; then
  read -r -p "This REPLACES everything in $DB with the production copy. Type the name to continue: " ans
  [ "$ans" = "$NAME" ] || { echo aborted; exit 1; }
fi

echo "== stopping $NAME"
docker compose -p "rgp-$NAME" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ROOT/deploy/tenants/$NAME.env" stop api >/dev/null 2>&1 || true

echo "== restoring and upgrading in $SCRATCH (as the customer's own role, so it owns everything)"
pgs -c "alter role \"$ROLE\" createdb"
trap 'pgs -c "alter role \"$ROLE\" nocreatedb" >/dev/null 2>&1 || true' EXIT
PG_PREFIX="docker exec -i $PGC" PGUSER="$ROLE" bash "$ROOT/scripts/prod-upgrade.sh" rehearse "$DUMP" --scratch "$SCRATCH" --skip-fixes

echo "== swapping it in"
pgs -c "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('$DB', '$SCRATCH') and pid <> pg_backend_pid()" >/dev/null
pgs -c "drop database \"$DB\"" -c "alter database \"$SCRATCH\" rename to \"$DB\"" -c "revoke all on database \"$DB\" from public" -c "grant connect on database \"$DB\" to \"$ROLE\""

if [ -n "$BETA_PW" ]; then
  HASH="$(docker run --rm -e PW="$BETA_PW" -w /w -v "$ROOT_WIN/api-v2/node_modules:/w/node_modules:ro" node:22.14.0-alpine node -e "console.log(require('bcryptjs').hashSync(process.env.PW, 10))")"
  docker exec -i "$PGC" psql -U "$SUPER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -v h="$HASH" -c "update app_user set password = :'h' where password is not null"
  echo "  every login in the copy now has the beta password"
fi
if [ -n "$OWNER_ROLE" ]; then
  docker exec -i "$PGC" psql -U "$SUPER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -c "update app_user set role_id = (select id from app_role where name = '$OWNER_ROLE') where email = 'admin@rgp.com' and exists (select 1 from app_role where name = '$OWNER_ROLE')"
  echo "  admin@rgp.com is now $OWNER_ROLE"
fi

echo "== starting $NAME"
docker compose -p "rgp-$NAME" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ROOT/deploy/tenants/$NAME.env" up -d api >/dev/null
docker exec -i "$PGC" psql -U "$SUPER" -d "$DB" -X -At -c "select 'sales', count(*) from sale union all select 'products', count(*) from product union all select 'customers', count(*) from customer union all select 'users', count(*) from app_user"
echo "== $NAME now holds the production copy"
