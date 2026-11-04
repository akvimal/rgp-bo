#!/usr/bin/env bash
# Reset one user's password on a database that runs in Docker (the live or the beta stack).
#
#   scripts/reset-password.sh <email> [--beta | --db-container NAME --api-container NAME] [--db-user U] [--database D] [--password P | --random] [--hash H] [--dry-run]
#
#   --beta            use the beta stack: containers rgp-beta-db-1 and rgp-beta-api-1, user rgpapp, database rgpbeta
#   --db-container    the Postgres container            (default: found from the running containers, if only one matches)
#   --api-container   a container with the app's node_modules, used to make the hash (bcryptjs, the same one the app checks with)
#   --db-user         database user                     (default rgpapp)
#   --database        database name                     (default rgpdb)
#   --password P      the new password (otherwise it is asked for, typed hidden)
#   --random          make a random temporary password and print it once
#   --hash H          a bcrypt hash made elsewhere, when there is no api container to make it in
#   --dry-run         show which user would be changed, change nothing
#
# The password is never written to a file; it is passed to the hasher as an argument and to psql as a variable (so the $ characters
# in a bcrypt hash are not touched by the shell). The user's MFA is not changed: reset it in the app if the authenticator is lost.
set -euo pipefail
export MSYS_NO_PATHCONV=1

die() { echo "ERROR: $*" >&2; exit 1; }

email="${1:-}"; [ -n "$email" ] && [ "${email#-}" = "$email" ] || die "usage: $0 <email> [options] (see the top of this file)"
shift
DB_CONTAINER=""; API_CONTAINER=""; DB_USER="rgpapp"; DATABASE="rgpdb"; PASSWORD=""; RANDOM_PW=0; HASH=""; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --beta) DB_CONTAINER="rgp-beta-db-1"; API_CONTAINER="rgp-beta-api-1"; DATABASE="rgpbeta"; shift;;
    --db-container) DB_CONTAINER="$2"; shift 2;;
    --api-container) API_CONTAINER="$2"; shift 2;;
    --db-user) DB_USER="$2"; shift 2;;
    --database) DATABASE="$2"; shift 2;;
    --password) PASSWORD="$2"; shift 2;;
    --random) RANDOM_PW=1; shift;;
    --hash) HASH="$2"; shift 2;;
    --dry-run) DRY=1; shift;;
    *) die "unknown option: $1";;
  esac
done

command -v docker >/dev/null || die "docker is not installed here"
if [ -z "$DB_CONTAINER" ]; then
  found=$(docker ps --format '{{.Names}}' | grep -E 'db' | grep -v -E 'redis|analytics' || true)
  [ "$(echo "$found" | grep -c .)" = "1" ] || die "say which Postgres container to use with --db-container (running: $(echo $found | tr '\n' ' '))"
  DB_CONTAINER="$found"
fi
docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" || die "container $DB_CONTAINER is not running"

psql_in() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DATABASE" -v ON_ERROR_STOP=1 "$@"; }

# the user must exist, and exactly once
rows=$(psql_in -At -v e="$email" <<'SQL'
select id || ' | ' || coalesce(full_name, '') || ' | ' || email || ' | active=' || active from app_user where lower(email) = lower(:'e');
SQL
)
count=$(echo "$rows" | grep -c . || true)
[ "$count" = "1" ] || die "expected one user with the email $email in $DATABASE, found $count"
echo "User: $rows"
[ "$DRY" = 1 ] && { echo "(dry run: nothing changed)"; exit 0; }

if [ -z "$HASH" ]; then
  if [ "$RANDOM_PW" = 1 ]; then
    PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 12)#9a"
  elif [ -z "$PASSWORD" ]; then
    read -r -s -p "New password: " PASSWORD; echo
    read -r -s -p "Again: " again; echo
    [ "$PASSWORD" = "$again" ] || die "the two passwords differ"
  fi
  [ "${#PASSWORD}" -ge 8 ] || die "use at least 8 characters"
  [ -n "$API_CONTAINER" ] || die "give --api-container (it makes the hash), or a ready --hash"
  docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER" || die "container $API_CONTAINER is not running"
  HASH=$(docker exec "$API_CONTAINER" node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" "$PASSWORD")
fi
case "$HASH" in '$2'*) ;; *) die "that does not look like a bcrypt hash";; esac

psql_in -v h="$HASH" -v e="$email" <<'SQL'
update app_user set password = :'h' where lower(email) = lower(:'e') returning id, email;
SQL
echo "Password changed for $email."
[ "$RANDOM_PW" = 1 ] && echo "Temporary password: $PASSWORD   (tell the user to change it after signing in)"
exit 0
