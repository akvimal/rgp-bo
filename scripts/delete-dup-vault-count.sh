#!/usr/bin/env bash
# Delete the duplicate vault count (Mogappair West, 18 Nov 2026, variance -2926), keeping the earlier one.
# A count is only a record: the vault balance comes from store_vault_movements, so this does not change the balance.
# Usage: PSQL="docker exec -i <db-container> psql -U <user> -d <db> -v ON_ERROR_STOP=1" bash scripts/delete-dup-vault-count.sh
set -euo pipefail

# --- connection: edit to match the VPS ---
PSQL="${PSQL:-psql -h localhost -U rgpapp -d rgpdb -v ON_ERROR_STOP=1}"

WHERE="s.location ILIKE '%Mogappair West%' AND c.variance = -2926
       AND c.counted_on >= '2026-11-18' AND c.counted_on < '2026-11-19'"

echo "== Matching counts =="
$PSQL -c "SELECT c.id, c.counted_on, c.expected, c.counted, c.variance, u.full_name
          FROM store_vault_counts c JOIN stores s ON s.id=c.store_id JOIN app_user u ON u.id=c.counted_by
          WHERE $WHERE ORDER BY c.id;"

N=$($PSQL -At -c "SELECT count(*) FROM store_vault_counts c JOIN stores s ON s.id=c.store_id WHERE $WHERE;")
if [ "$N" != "2" ]; then
  echo "Expected exactly 2 matching rows, found $N. Nothing changed."; exit 1
fi

ID=$($PSQL -At -c "SELECT max(c.id) FROM store_vault_counts c JOIN stores s ON s.id=c.store_id WHERE $WHERE;")
echo "Will delete the later duplicate: id $ID (the earlier one stays)."
read -r -p "Type YES to continue: " OK
[ "$OK" = "YES" ] || { echo "Cancelled."; exit 1; }

# backup of the table before the delete (written where psql runs; with docker exec that is inside the container)
BK="store_vault_counts_backup_$(date +%Y%m%d_%H%M%S).csv"
$PSQL -c "\copy (SELECT * FROM store_vault_counts) TO '$BK' CSV HEADER" 2>/dev/null || \
  echo "(csv backup skipped: take a pg_dump -t store_vault_counts yourself if you have not)"

$PSQL <<SQL
BEGIN;
DELETE FROM store_vault_counts WHERE id = $ID AND variance = -2926;
COMMIT;
SQL

echo "== Remaining counts for that day =="
$PSQL -c "SELECT c.id, c.counted_on, c.variance FROM store_vault_counts c JOIN stores s ON s.id=c.store_id
          WHERE s.location ILIKE '%Mogappair West%' AND c.counted_on >= '2026-11-18' ORDER BY c.id;"
