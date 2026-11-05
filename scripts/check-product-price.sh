#!/usr/bin/env bash
# Shows which purchase each part of the "Set the price" dialog uses for a product, and the legal ceiling each would give. READ ONLY: SELECTs only.
#
#   bash scripts/check-product-price.sh AMRUTANJAN        a product by part of its name (or its id)
#
# The dialog shows the cost and MRP from price_view: the item on the NEWEST invoice date, whatever the invoice status (a draft counts).
# The pricing policy (lowest price, legal ceiling, largest raise) uses the NEWEST COMPLETED invoice that has an MRP and a rate.
# When those are two different purchases (a newer draft invoice with a new MRP), the two parts of the dialog disagree.
# Legal ceiling = MRP / (1 + the GST the till bills), the till billing at most the sale_gst_cap_pct setting (5 by default).
#
# Which database: by default the beta (compose project rgp-beta). Another: PSQL="docker exec -i <db container> psql -U <user> -d <db>" bash scripts/check-product-price.sh ...
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${PROJECT:-rgp-beta}"
USER_="${POSTGRES_USER:-rgpapp}"
DB_="${POSTGRES_DB:-rgpbeta}"
if [ -z "${PSQL:-}" ]; then
  COMPOSE="docker compose -p $PROJECT -f docker-compose.beta.yml --env-file .env.beta"
  [ -n "${BETA_EDGE_NETWORK:-}" ] && COMPOSE="$COMPOSE -f docker-compose.beta.yml -f docker-compose.beta.edge.yml"
  PSQL="$COMPOSE exec -T db psql -U $USER_ -d $DB_"
fi

q="${1:-}"
[ -z "$q" ] && { echo "Usage: bash scripts/check-product-price.sh <part of the product name, or its id>"; exit 1; }
q="${q//\'/}"
if [[ "$q" =~ ^[0-9]+$ ]]; then WHERE="p.id = $q"; else WHERE="p.title ilike '%$q%'"; fi

$PSQL -q -v ON_ERROR_STOP=1 -P pager=off <<SQL
create temp table cpp_prod as select p.id, p.title from product p where $WHERE and not p.archive order by p.active desc, p.title limit 3;
\echo ================================================================  the product(s) matched
select * from cpp_prod;

\echo
\echo ================================================================  its purchases, newest invoice first (the top rows are the ones that matter)
select pi.invoice_date as date, coalesce(pi.invoice_no, 'challan ' || pi.challan_no) as invoice, pi.status, pii.batch, to_char(pii.exp_date, 'YYYY-MM') as expiry,
       pii.mrp_cost as mrp, pii.ptr_value as rate, pii.tax_pcnt as batch_gst, pii.ptr_cost as cost_with_gst,
       round((pii.mrp_cost / (1 + public.sale_gst(pii.tax_pcnt::double precision) / 100))::numeric, 2) as ceiling_for_this_mrp
  from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.active and not pi.archive
 where pii.product_id in (select id from cpp_prod) and pii.active and not pii.archive
 order by pi.invoice_date desc, pii.id desc limit 8;

\echo
\echo ================================================================  what each part uses
select 'dialog Now block (price_view)' as part, v.mrp, v.ptr as cost_with_gst, v.tax as batch_gst, v.sale_tax as gst_billed, round((v.mrp / (1 + v.sale_tax / 100))::numeric, 2) as legal_ceiling_from_it
  from price_view v where v.id in (select id from cpp_prod)
union all
select 'pricing policy (latest COMPLETED purchase)', x.mrp_cost, x.ptr_cost, x.tax_pcnt, public.sale_gst(x.tax_pcnt::double precision), round((x.mrp_cost / (1 + public.sale_gst(x.tax_pcnt::double precision) / 100))::numeric, 2)
  from (select pii.mrp_cost, pii.ptr_cost, pii.tax_pcnt from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
         where pii.product_id in (select id from cpp_prod) and pii.active and not pii.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
         order by pi.invoice_date desc, pii.id desc limit 1) x;

\echo
\echo Reading it: if the two rows above have different mrp, the dialog and the policy are looking at different purchases (usually a newer invoice that is still a draft).
\echo The policy ceiling is the one that is enforced when the price is saved.
SQL
