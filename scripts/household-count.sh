#!/usr/bin/env bash
# How common are shared mobile numbers (the same mobile under different names)? READ ONLY: SELECTs in one read-only transaction.
#
#   bash scripts/household-count.sh                 counts only
#   DETAIL=1 bash scripts/household-count.sh        also the 15 most shared numbers, last 4 digits only
#
# Counts only: no name and no full number is printed. See docs/planning/CUSTOMER_HOUSEHOLDS.md, step 0.
#
# Which database: by default the beta (compose project rgp-beta), like the other check scripts. Another:
#   PSQL="docker exec -i <db container> psql -U <user> -d <db>" bash scripts/household-count.sh
# On the VPS the live database is usually the prod compose project: PROJECT=rgp-prod POSTGRES_DB=rgpdb bash scripts/household-count.sh (adjust to your compose files).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${PROJECT:-rgp-beta}"
USER_="${POSTGRES_USER:-rgpapp}"
DB_="${POSTGRES_DB:-rgpbeta}"
COMPOSE_FILE_="${COMPOSE_FILE_:-docker-compose.beta.yml}"
ENV_FILE_="${ENV_FILE_:-.env.beta}"
if [ -z "${PSQL:-}" ]; then
  COMPOSE="docker compose -p $PROJECT -f $COMPOSE_FILE_ --env-file $ENV_FILE_"
  [ -n "${BETA_EDGE_NETWORK:-}" ] && COMPOSE="$COMPOSE -f docker-compose.beta.edge.yml"
  PSQL="$COMPOSE exec -T db psql -U $USER_ -d $DB_"
fi

# the file goes in on stdin, so it works with a psql inside a container; the transaction is read only, so nothing can be changed
$PSQL -q -P pager=off -v detail="${DETAIL:-0}" < scripts/household-count.sql
