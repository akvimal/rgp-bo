#!/usr/bin/env bash
# Builds (or rebuilds) the demo template: a throwaway customer on the Chain plan (every module on) is created, filled with invented
# sample data through the app's own API, saved as the template, then removed. New demos are copied from the template.
#   CONTROL_PLANE_ADMIN_PASSWORD=... scripts/demo-template-build.sh
# Rebuild now and then: the sample sales are dated relative to the day the template was built.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CP="${CONTROL_PLANE_URL:-http://localhost:4000}"
SLUG="demo-template-build"
OWNER_EMAIL="owner@template.demo"
OWNER_PASSWORD="Template-build-1"
STAFF_PASSWORD="$OWNER_PASSWORD"
: "${CONTROL_PLANE_ADMIN_PASSWORD:?set CONTROL_PLANE_ADMIN_PASSWORD}"

json() { python -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
TOKEN="$(curl -fsS -X POST "$CP/admin/login" -H 'content-type: application/json' -d "{\"password\":\"$CONTROL_PLANE_ADMIN_PASSWORD\"}" | json 'd["token"]')"
cp() { curl -sS -X "$1" "$CP$2" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' ${3:+-d "$3"}; }

echo "== removing an earlier build"
if cp GET "/tenants/$SLUG" | grep -q '"slug"'; then
  docker compose -p "rgp-$SLUG" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ROOT/deploy/tenants/$SLUG.env" down -v >/dev/null 2>&1 || true
  cp POST "/tenants/$SLUG/close" >/dev/null; cp DELETE "/tenants/$SLUG?confirm=$SLUG" >/dev/null
fi

echo "== creating the throwaway customer"
cp POST /tenants "{\"slug\":\"$SLUG\",\"name\":\"Sample Pharmacy\",\"ownerName\":\"Sample Owner\",\"ownerEmail\":\"$OWNER_EMAIL\",\"ownerPassword\":\"$OWNER_PASSWORD\",\"plan\":\"chain\",\"trialDays\":1}" >/dev/null
bash "$ROOT/scripts/tenant-up.sh" "$SLUG" | tail -1
PORT="$(grep '^TENANT_PORT=' "$ROOT/deploy/tenants/$SLUG.env" | cut -d= -f2)"
for _ in $(seq 1 40); do
  curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT/api/auth/login" -X POST -H 'content-type: application/json' -d '{}' | grep -qE '^(400|401|201)$' && break; sleep 3
done

echo "== filling it with sample data"
API="http://localhost:$PORT/api" OWNER_EMAIL="$OWNER_EMAIL" OWNER_PASSWORD="$OWNER_PASSWORD" STAFF_PASSWORD="$STAFF_PASSWORD" node "$ROOT/control-plane/scripts/seed-sample.mjs"

echo "== saving the template"
cp POST /demo-template/capture "{\"slug\":\"$SLUG\"}"; echo

echo "== removing the throwaway customer"
docker compose -p "rgp-$SLUG" -f "$ROOT/docker-compose.tenant.yml" --env-file "$ROOT/deploy/tenants/$SLUG.env" down -v >/dev/null 2>&1 || true
cp POST "/tenants/$SLUG/close" >/dev/null; cp DELETE "/tenants/$SLUG?confirm=$SLUG" >/dev/null
rm -f "$ROOT/deploy/tenants/$SLUG.env"
echo "== demo template ready"
