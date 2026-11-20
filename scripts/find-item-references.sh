#!/usr/bin/env bash
# Which rows block deleting a purchase invoice line? READ ONLY. Finds every table with a foreign key to purchase_invoice_item and counts the rows pointing at the line.
#   PSQL="docker exec -i rgp-beta-db-1 psql -U rgpapp -d rgpbeta" bash scripts/find-item-references.sh 54013
set -euo pipefail
cd "$(dirname "$0")/.."
ID="${1:?give the invoice line id, e.g. 54013}"
[[ "$ID" =~ ^[0-9]+$ ]] || { echo "the id must be a number"; exit 1; }
PSQL="${PSQL:-docker compose -p rgp-beta -f docker-compose.beta.yml --env-file .env.beta exec -T db psql -U ${POSTGRES_USER:-rgpapp} -d ${POSTGRES_DB:-rgpbeta}}"
$PSQL -X -v ON_ERROR_STOP=1 -At <<SQL
select 'line $ID: status ' || status || ', invoice ' || invoice_id from purchase_invoice_item where id = $ID;
do \$\$
declare r record; n bigint;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.purchase_invoice_item'::regclass
  loop
    execute format('select count(*) from %s where %I = $ID', r.tbl, r.col) into n;
    raise notice '% .% : % row(s)%', r.tbl, r.col, n, case when n > 0 then '   <-- blocks the delete' else '' end;
  end loop;
end \$\$;
SQL
