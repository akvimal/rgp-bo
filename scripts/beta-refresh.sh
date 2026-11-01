#!/usr/bin/env bash
# Load a dump of the live database into the BETA stack, bring it to the current schema, and start the new app on it.
# Run it again with a newer dump whenever the beta should be brought back in line with the live data (everything entered in the beta is replaced).
# The same steps are the cutover: run it with the last dump, then move the live address to the new stack.
#
#   scripts/beta-refresh.sh <pg_dump -Fc file> [--cutoff YYYY-MM-DD] [--approve "01 03"] [--no-build]
#
# It only ever talks to the containers of the compose project "rgp-beta" (its own database), never to the live database.
# The dump comes from the live database with a read-only copy:   pg_dump -Fc -U <user> <db> > rgp_prod.dump
set -euo pipefail
export MSYS_NO_PATHCONV=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROJECT="rgp-beta"
COMPOSE="docker compose -p $PROJECT -f docker-compose.beta.yml --env-file .env.beta"

dump="${1:-}"; shift || true
cutoff=""; approve=""; build=1
while [ $# -gt 0 ]; do
  case "$1" in
    --cutoff) cutoff="$2"; shift 2;;
    --approve) approve="$2"; shift 2;;
    --no-build) build=0; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }
[ -f "$dump" ] || die "usage: $0 <pg_dump -Fc file> [--cutoff YYYY-MM-DD] [--approve \"01 03\"] [--no-build]"
[ -f .env.beta ] || die ".env.beta is missing: copy .env.beta.example and fill it in"
set -a; . ./.env.beta; set +a
[ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${JWT_KEY:-}" ] || die "set POSTGRES_PASSWORD and JWT_KEY in .env.beta"
export POSTGRES_USER="${POSTGRES_USER:-rgpapp}" POSTGRES_DB="${POSTGRES_DB:-rgpbeta}"

echo "== dump: $(basename "$dump") ($(du -h "$dump" | cut -f1)) -> project $PROJECT, database $POSTGRES_DB"
$COMPOSE up -d db
printf "== waiting for the database "
for _ in $(seq 1 60); do
  [ "$($COMPOSE ps --format '{{.Health}}' db 2>/dev/null | head -1)" = "healthy" ] && break
  printf "."; sleep 2
done
echo

# the app must not hold the database open while it is replaced
$COMPOSE stop api frontend >/dev/null 2>&1 || true

export PG_PREFIX="$COMPOSE exec -T db"
export PGUSER="$POSTGRES_USER"
args=(rehearse "$dump" --scratch "$POSTGRES_DB")
[ -n "$cutoff" ] && args+=(--cutoff "$cutoff")
[ -n "$approve" ] && args+=(--approve "$approve")
"$ROOT/scripts/prod-upgrade.sh" "${args[@]}" 2>&1 | tee "$ROOT/beta-refresh.log" | sed 's/^/   /' || true
grep -q "RESULT: PASS" "$ROOT/beta-refresh.log" || die "the upgrade checks did not pass: the app was NOT started (see beta-refresh.log)"

if [ "$build" = 1 ]; then $COMPOSE up -d --build api frontend; else $COMPOSE up -d api frontend; fi
printf "== waiting for the app "
for _ in $(seq 1 60); do
  [ "$($COMPOSE ps --format '{{.Health}}' api 2>/dev/null | head -1)" = "healthy" ] && break
  printf "."; sleep 3
done
echo
echo "== done: the new version is on http://localhost:${BETA_PORT:-8080} (the database is $POSTGRES_DB; the log is beta-refresh.log)"
