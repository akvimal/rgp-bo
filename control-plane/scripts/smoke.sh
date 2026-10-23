#!/usr/bin/env bash
# End-to-end check of the control plane against a running tenant (use after scripts/tenant-up.sh <name>):
#   CONTROL_PLANE_ADMIN_PASSWORD=... OWNER_EMAIL=... OWNER_PASSWORD=... control-plane/scripts/smoke.sh <name> <tenant-port>
# Suspends the tenant, checks its app stops trading, reactivates it, checks it trades again and that the plan limits hold.
set -uo pipefail
NAME="${1:?name}"; PORT="${2:?port}"
CP="${CONTROL_PLANE_URL:-http://localhost:4000}"
fails=0
ok() { echo "  ok   $1"; }
bad() { echo "  FAIL $1"; fails=$((fails+1)); }
py() { python -c "$1"; }

ADMIN="$(curl -fsS -X POST "$CP/admin/login" -H 'content-type: application/json' -d "{\"password\":\"$CONTROL_PLANE_ADMIN_PASSWORD\"}" | py 'import sys,json;print(json.load(sys.stdin)["token"])')"
cp() { curl -s -X "$1" "$CP$2" -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' ${3:+-d "$3"}; }
login() { curl -s -X POST "localhost:$PORT/api/auth/login" -H 'content-type: application/json' -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\",\"scope\":\"business\"}" | py 'import sys,json;print(json.load(sys.stdin).get("token",""))'; }
code() { curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT/api$1" -H "authorization: Bearer $TOKEN"; }
wait_for() { for _ in $(seq 1 24); do [[ "$(code "$1")" == "$2" ]] && return 0; sleep 5; done; return 1; }

TOKEN="$(login)"; [[ -n "$TOKEN" ]] && ok "owner can sign in" || bad "owner cannot sign in"
cp POST "/tenants/$NAME/activate" >/dev/null
[[ "$(code /stores)" == "200" ]] && ok "active tenant trades" || bad "active tenant should trade"

echo "-- plan limit"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X POST "localhost:$PORT/api/stores" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"location":"Second store"}')"
[[ "$STATUS" == "403" ]] && ok "a second store is refused on a one-store plan" || bad "second store should be refused (got $STATUS)"

echo "-- suspend"
cp POST "/tenants/$NAME/suspend" >/dev/null
wait_for /stores 403 && ok "suspended tenant is stopped within two minutes" || bad "tenant still trading after suspension"
[[ -n "$(login)" ]] && ok "owner can still sign in to see why" || bad "sign-in should still work"
curl -s "localhost:$PORT/api/auth/me" -H "authorization: Bearer $TOKEN" | py 'import sys,json;d=json.load(sys.stdin);assert d["platform"]["status"]=="suspended", d' && ok "the app is told it is suspended" || bad "platform status missing"

echo "-- reactivate"
cp POST "/tenants/$NAME/activate" >/dev/null
wait_for /stores 200 && ok "reactivated tenant trades again" || bad "tenant still stopped after reactivation"

echo "-- plan change"
cp PUT "/tenants/$NAME" '{"plan":"chain"}' >/dev/null
wait_for /store-stock-transfers 200 && ok "a plan with transfers lets the module through" || bad "plan change did not reach the app"
cp PUT "/tenants/$NAME" '{"plan":"shop"}' >/dev/null
wait_for /store-stock-transfers 403 && ok "back to a plan without transfers: refused" || bad "downgrade did not reach the app"

echo; [[ $fails -eq 0 ]] && echo "ALL OK" || echo "$fails FAILED"; exit $fails
