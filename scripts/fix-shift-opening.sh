#!/usr/bin/env bash
# Correct the opening cash (by denomination) of one shift, leaving its bills, expenses and everything else attached.
#
#   fix-shift-opening.sh show [--date YYYY-MM-DD]                       list that day's shifts with their opening notes
#   fix-shift-opening.sh set --shift ID --notes "500x4,100x10,50x2"     set the opening to exactly these notes (face value x count)
#
# The opening cash becomes the total of the notes, the shift's expected cash moves by the same difference, and for a closed
# shift the variance is worked out again against the count that was made at close. The old figures are printed first.
# --yes skips the typed confirmation, --no-backup skips the pg_dump.
#
# Where Postgres lives is set by environment, as in clear-day.sh:
#   PG_PREFIX   e.g. "docker exec -i rgp-db"   PGUSER (default rgpapp)   PGDATABASE (default rgpdb)
set -euo pipefail
export MSYS_NO_PATHCONV=1

PG_PREFIX="${PG_PREFIX:-}"
PGUSER="${PGUSER:-rgpapp}"
PGDATABASE="${PGDATABASE:-rgpdb}"
export PGUSER

mode="${1:-show}"; shift || true
day="$(TZ=Asia/Kolkata date +%F)"; shift_id=""; notes=""; yes=0; backup=1
while [ $# -gt 0 ]; do
  case "$1" in
    --date) day="$2"; shift 2;;
    --shift) shift_id="$2"; shift 2;;
    --notes) notes="$2"; shift 2;;
    --yes) yes=1; shift;;
    --no-backup) backup=0; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
[ "$mode" = "show" ] || [ "$mode" = "set" ] || { echo "usage: $0 show [--date D] | set --shift ID --notes \"500x4,100x10\"" >&2; exit 2; }
[[ "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--date must be YYYY-MM-DD" >&2; exit 2; }

psqlq() { $PG_PREFIX psql -q -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"; }

if [ "$mode" = "show" ]; then
  echo "select id, store_id, name, status, opening_cash, expected_cash, counted_cash, variance, opening_denominations from store_shifts where shift_date = '$day' order by id;" | psqlq
  exit 0
fi

# ---- set
[[ "$shift_id" =~ ^[0-9]+$ ]] || { echo "--shift ID is required (find it with: $0 show)" >&2; exit 2; }
[ -n "$notes" ] || { echo "--notes is required, e.g. --notes \"500x4,100x10,50x2\"" >&2; exit 2; }

# "500x4,100x10" -> [{"d":500,"n":4},{"d":100,"n":10}], only the fixed set of notes and coins, each once
json="["; total=0; seen=" "; first=1
IFS=',' read -ra parts <<< "$notes"
for p in "${parts[@]}"; do
  p="${p// /}"
  [[ "$p" =~ ^([0-9]+)[xX*]([0-9]+)$ ]] || { echo "Cannot read '$p'. Write each as face value x count, e.g. 500x4" >&2; exit 2; }
  d="${BASH_REMATCH[1]}"; n="${BASH_REMATCH[2]}"
  case "$d" in 2000|500|200|100|50|20|10|5|2|1) ;; *) echo "$d is not a note or coin we count (2000, 500, 200, 100, 50, 20, 10, 5, 2, 1)." >&2; exit 2;; esac
  case "$seen" in *" $d "*) echo "$d is listed twice. Add the counts together on one entry." >&2; exit 2;; esac
  seen="$seen$d "
  [ "$n" -gt 0 ] || continue
  [ "$first" = 1 ] || json="$json,"; first=0
  json="$json{\"d\":$d,\"n\":$n}"
  total=$((total + d * n))
done
json="$json]"
[ "$total" -gt 0 ] || { echo "The notes add up to nothing." >&2; exit 2; }

echo "Shift $shift_id now:"
echo "select id, store_id, name, status, shift_date, opening_cash, expected_cash, counted_cash, variance, opening_denominations from store_shifts where id = $shift_id;" | psqlq
echo "Opening will become: $total   $json"
[ "$(echo "select count(*) from store_shifts where id = $shift_id;" | psqlq -At)" = "1" ] || { echo "No such shift." >&2; exit 1; }

if [ "$backup" = 1 ]; then
  out="${HOME:-.}/before_opening_fix_${shift_id}_$(date +%H%M%S).sql.gz"
  echo "Backing up to $out ..."
  $PG_PREFIX pg_dump -U "$PGUSER" "$PGDATABASE" | gzip > "$out"
fi
if [ "$yes" != 1 ]; then
  read -r -p "Type the shift number ($shift_id) to apply: " typed
  [ "$typed" = "$shift_id" ] || { echo "Not confirmed. Nothing changed."; exit 1; }
fi

echo "
begin;
update store_shifts set
  expected_cash = expected_cash + ($total - opening_cash),
  variance      = case when counted_cash is null then null else counted_cash - (expected_cash + ($total - opening_cash)) end,
  opening_cash  = $total,
  opening_denominations = '$json'::jsonb,
  updated_on    = now()
where id = $shift_id;
commit;
select id, opening_cash, expected_cash, counted_cash, variance, opening_denominations from store_shifts where id = $shift_id;
" | psqlq
echo "Done."
