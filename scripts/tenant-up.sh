#!/usr/bin/env bash
# Starts (or restarts, or stops) one customer's copy of the app.
#   scripts/tenant-up.sh <name>          start / update
#   scripts/tenant-up.sh <name> down     stop (data is kept)
# Needs the control plane running. Set CONTROL_PLANE_ADMIN_PASSWORD (or you will be asked) and, if it is not on this
# machine's port 4000, CONTROL_PLANE_URL.
set -euo pipefail
NAME="${1:?usage: tenant-up.sh <name> [down]}"
ACTION="${2:-up}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CP="${CONTROL_PLANE_URL:-http://localhost:4000}"
mkdir -p "$ROOT/deploy/tenants"
ENVFILE="$ROOT/deploy/tenants/$NAME.env"

if [[ -z "${CONTROL_PLANE_ADMIN_PASSWORD:-}" && "$ACTION" == "up" ]]; then
  read -r -s -p "Control plane admin password: " CONTROL_PLANE_ADMIN_PASSWORD; echo
fi

if [[ "$ACTION" == "up" ]]; then
  TOKEN="$(curl -fsS -X POST "$CP/admin/login" -H 'content-type: application/json' \
            -d "{\"password\":\"$CONTROL_PLANE_ADMIN_PASSWORD\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')"
  curl -fsS "$CP/tenants/$NAME/env" -H "authorization: Bearer $TOKEN" > "$ENVFILE"
  chmod 600 "$ENVFILE" 2>/dev/null || true
  docker compose -p "rgp-$NAME" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ENVFILE" up -d --build
  PORT="$(grep '^TENANT_PORT=' "$ENVFILE" | cut -d= -f2)"
  echo "== $NAME is starting: http://localhost:$PORT =="
else
  docker compose -p "rgp-$NAME" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ENVFILE" "$ACTION"
fi
