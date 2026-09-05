#!/usr/bin/env bash
# Bring up the full QA stack at the branch schema, from scratch.
#   --keep-db : skip the destructive volume reset (schema/data already loaded)
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

KEEP_DB=0
[[ "${1:-}" == "--keep-db" ]] && KEEP_DB=1

echo "== QA stack up  (frontend :$FRONTEND_PORT  api :$API_PORT  db :$DB_PORT) =="

if [[ $KEEP_DB -eq 0 ]]; then
  echo "[1/5] tearing down + wiping volumes"
  "${COMPOSE[@]}" down -v --remove-orphans || true

  echo "[2/5] building images (api, frontend)"
  "${COMPOSE[@]}" build

  echo "[3/5] starting postgres (fresh, empty)"
  "${COMPOSE[@]}" up -d postgres
  wait_for_pg

  echo "[4/5] loading schema + demo data"
  bash "$QA_DIR/scripts/bootstrap-db.sh"
else
  echo "[1-4/5] --keep-db: reusing existing volume"
  "${COMPOSE[@]}" build
  "${COMPOSE[@]}" up -d postgres
  wait_for_pg
fi

echo "[5/5] starting api + frontend"
"${COMPOSE[@]}" up -d api frontend

wait_for_http "http://localhost:$API_PORT/api" "api (swagger)"
wait_for_http "http://localhost:$FRONTEND_PORT" "frontend"

echo
echo "== stack ready =="
echo "  frontend : http://localhost:$FRONTEND_PORT"
echo "  api      : http://localhost:$API_PORT   (swagger /api)"
echo "  db       : postgresql://$POSTGRES_USER:***@localhost:$DB_PORT/$POSTGRES_DB"
echo "  login    : businesshead@local.test / ${QA_ADMIN_PASS:-admin123}"
