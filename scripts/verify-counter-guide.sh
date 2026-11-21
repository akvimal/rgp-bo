#!/usr/bin/env bash
# Read-only check that migrations 233-237 (brand price lookup, price reference, market price, counter guide)
# are in place, so "Check brand" and "Counter guide" can show in Sales.
# Changes nothing. Usage:
#   DB="postgresql://USER:PASSWORD@HOST:5432/DBNAME" scripts/verify-counter-guide.sh
#   (or set DATABASE_URL instead of DB)
# Exit code is the number of problems found (0 = all good).
set -u
DB="${DB:-${DATABASE_URL:-}}"
[ -n "$DB" ] || { echo "Set DB (or DATABASE_URL) to the connection string."; exit 99; }
command -v psql >/dev/null || { echo "psql not found."; exit 99; }

bad=0
q() { psql "$DB" -At -v ON_ERROR_STOP=1 -c "$1" 2>/dev/null; }
ok()   { printf '  [ ok ] %s\n' "$1"; }
fail() { printf '  [FAIL] %s\n' "$1"; bad=$((bad+1)); }
warn() { printf '  [warn] %s\n' "$1"; }

echo "== Connection"
[ "$(q 'select 1')" = "1" ] && ok "database reachable" || { fail "cannot connect"; exit 98; }

echo "== Migrations recorded (schema_migrations)"
if [ "$(q "select to_regclass('public.schema_migrations') is not null")" = "t" ]; then
  for n in 233_brand_price_lookup 234_price_reference 235_market_price_lookup 236_counter_guide 237_counter_guide_dose; do
    [ "$(q "select count(*) from schema_migrations where name='$n'")" = "1" ] && ok "$n" || warn "$n not recorded (check the tables below: it may have been applied by hand)"
  done
else
  warn "no schema_migrations table: judging by the tables below"
fi

echo "== Tables"
for t in brand_price_lookup price_ref_source price_ref_item market_price_lookup guide_card guide_warning guide_option; do
  [ "$(q "select to_regclass('public.$t') is not null")" = "t" ] && ok "table $t" || fail "table $t missing"
done

echo "== Columns added by 236/237"
for c in guide_card.icon guide_warning.icon guide_option.dose guide_option.days; do
  t=${c%%.*}; col=${c##*.}
  [ "$(q "select count(*) from information_schema.columns where table_name='$t' and column_name='$col'")" = "1" ] && ok "$c" || fail "$c missing"
done

echo "== Business type (Check brand and Counter guide show only for the pharmacy pack)"
rows=$(q "select id||' | '||coalesce(name,'')||' | '||coalesce(business_type,'NULL') from business order by id")
[ -n "$rows" ] && printf '%s\n' "$rows" | sed 's/^/         /'
if [ "$(q "select count(*) from business where business_type='pharmacy'")" -ge 1 ] 2>/dev/null; then ok "a pharmacy business exists"
else fail "no business has business_type = 'pharmacy': both buttons stay hidden"; fi

echo "== Counter guide permission (migration 236)"
tot=$(q "select count(*) from app_role")
have=$(q "select count(*) from app_role where permissions::text like '%\"counterguide\"%'")
echo "         roles with the counterguide permission: ${have:-0} of ${tot:-?}"
[ "${have:-0}" -ge 1 ] 2>/dev/null && ok "granted to at least one role (others: tick it in Settings > Roles)" || fail "no role has counterguide; sign-in will not show it"

echo "== Counter guide cards"
cards=$(q "select count(*) from guide_card"); appr=$(q "select count(*) from guide_card where status='APPROVED'" || echo "?")
echo "         cards: ${cards:-0}, approved: ${appr:-?}"
[ "${cards:-0}" -ge 1 ] 2>/dev/null && ok "starter cards present" || warn "no cards yet (start the API once, or load them from Settings > Counter guide)"
[ "${appr:-0}" -ge 1 ] 2>/dev/null || warn "no approved card: the guide shows no problems until a pharmacist approves them"

echo
[ $bad -eq 0 ] && echo "All checks passed. Restart the API, hard-refresh the browser (Ctrl+Shift+R) and sign in again." \
               || echo "$bad problem(s). Fix those, then run this again."
exit $bad
