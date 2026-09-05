#!/usr/bin/env bash
# Shared env + helpers for the QA stack scripts. Source this; don't run it.
set -euo pipefail

# repo root: Windows-style path (D:/...) so Git Bash does NOT mangle the compose -f args,
# and docker.exe gets a path it understands. Container-side paths ("/sql/...") are passed
# double-slashed ("//sql/...") by callers to survive MSYS arg conversion.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && { pwd -W 2>/dev/null || pwd; })"
QA_DIR="$REPO_ROOT/qa"

# load qa/.env if present (only well-formed KEY=VALUE lines, no command execution)
if [[ -f "$QA_DIR/.env" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "${line?}"
    fi
  done < "$QA_DIR/.env"
fi

# Port remap (8000 is commonly occupied on dev machines) + safe token lifetime.
export FRONTEND_PORT="${FRONTEND_PORT:-8100}"
export API_PORT="${API_PORT:-3000}"
export DB_PORT="${DB_PORT:-5432}"
export JWT_EXPIRES="${JWT_EXPIRES:-24h}"
export JWT_KEY="${JWT_KEY:-dev}"
export POSTGRES_USER="${POSTGRES_USER:-rgpapp}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-r9pAdmin7}"
export POSTGRES_DB="${POSTGRES_DB:-rgpdb}"

COMPOSE=(docker compose
  --project-name "${QA_COMPOSE_PROJECT:-rgp-bo}"
  -f "$REPO_ROOT/docker-compose.dev.yml"
  -f "$REPO_ROOT/qa/docker/compose.qa.yml")

# psql inside the postgres container (superuser = POSTGRES_USER on this image)
psql_c() {
  "${COMPOSE[@]}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$@"
}

wait_for_pg() {
  echo "  waiting for postgres..."
  for i in $(seq 1 60); do
    if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      echo "  postgres ready"; return 0
    fi
    sleep 2
  done
  echo "  postgres did not become ready" >&2; return 1
}

wait_for_http() {
  local url="$1" name="$2"
  echo "  waiting for $name ($url)..."
  for i in $(seq 1 90); do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 "$url" || true)"
    if [[ "$code" != "000" ]]; then echo "  $name up (HTTP $code)"; return 0; fi
    sleep 2
  done
  echo "  $name did not respond" >&2; return 1
}
