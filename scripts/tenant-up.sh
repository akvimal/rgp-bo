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
  # a new release may need schema changes: apply the files this customer has not had before its app starts
  MIG="$(curl -sS -X POST "$CP/tenants/$NAME/migrate" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "${MIGRATE_BASELINE:+{\"baseline\":\"$MIGRATE_BASELINE\"\}}")"
  case "$MIG" in *'"applied"'*) echo "schema: $MIG" ;; *) echo "schema update failed: $MIG" >&2; exit 1 ;; esac
  # the platform's own keys for the assistant (one account for every customer), from the git-ignored .env.platform. A customer's own
  # settings (their key, or the assistant switched off) are already in their env file and win: nothing of the platform's is added then.
  if [[ -f "$ROOT/.env.platform" ]]; then
    OWN=0; grep -qE '^(OPENROUTER_API_KEY|ANTHROPIC_API_KEY|AI_PROVIDER)=' "$ENVFILE" && OWN=1
    while IFS='=' read -r K V; do
      [[ -z "$V" ]] && continue
      grep -q "^$K=" "$ENVFILE" && continue
      [[ "$OWN" == 1 && ( "$K" == *KEY || "$K" == AI_PROVIDER ) ]] && continue
      export "$K=$V"
    done < <(grep -E '^(OPENROUTER_API_KEY|ANTHROPIC_API_KEY|AI_PROVIDER|AI_MODEL|AI_ALLOWED_MODELS)=' "$ROOT/.env.platform" || true)
  fi
  docker compose -p "rgp-$NAME" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ENVFILE" up -d --build
  PORT="$(grep '^TENANT_PORT=' "$ENVFILE" | cut -d= -f2)"
  echo "== $NAME is starting: http://localhost:$PORT =="
else
  docker compose -p "rgp-$NAME" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ENVFILE" "$ACTION"
fi
