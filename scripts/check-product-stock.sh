#!/usr/bin/env bash
# Shows why a product's stock differs between the Stock screen ("Avail") and the Reorder screen ("Stock"). READ ONLY: SELECTs only.
#
#   bash scripts/check-product-stock.sh BICIPHAGE          a product by part of its name (or its id)
#
# It works out the product's stock the way each screen does, and lists the batches that pull it down:
#   Stock screen  every store together; batches that are expired or expire within 30 days are left out of "Avail" (they are on the Expiry tab)
#   Reorder       one store only (the store chosen at the top of the page): purchases made AT that store, less sales made AT that store, plus its adjustments;
#                 expired batches are NOT left out, and a batch's negative balance is not hidden
# So a product whose old (expired) batches were sold more than was bought can look fine on Stock and very negative on Reorder.
#
# Which database: by default the beta (compose project rgp-beta). Another: PSQL="docker exec -i <db container> psql -U <user> -d <db>" bash scripts/check-product-stock.sh ...
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
[ -z "$q" ] && { echo "Usage: bash scripts/check-product-stock.sh <part of the product name, or its id>"; exit 1; }
q="${q//\'/}"
if [[ "$q" =~ ^[0-9]+$ ]]; then WHERE="p.id = $q"; else WHERE="p.title ilike '%$q%'"; fi

$PSQL -q -v ON_ERROR_STOP=1 -P pager=off <<SQL
create temp table cps_prod as
  select p.id, p.title, coalesce(p.pack, 1) as pack, p.active from product p where $WHERE and not p.archive order by p.active desc, p.title limit 5;

\echo ================================================================  the product(s) matched
select id, title, pack as units_per_pack, active from cps_prod;

create temp table cps_item as
  select pii.id as item_id, p.id as product_id, i.invoice_no, i.status as invoice_status, i.store_id as inv_store, pii.batch, pii.exp_date, i.invoice_date,
         ((pii.qty + coalesce(pii.free_qty, 0)) * p.pack)::numeric as purchased,
         (pii.exp_date is not null and public.expiry_end(pii.exp_date) < current_date + 30) as near_expired
    from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id and i.active and not i.archive join cps_prod p on p.id = pii.product_id
   where pii.active and not pii.archive;

create temp table cps_sold as
  select si.purchase_item_id as item_id, s.store_id as sale_store, sum(si.qty)::numeric as qty
    from sale_item si join sale s on s.id = si.sale_id
   where si.active and not si.archive and si.purchase_item_id in (select item_id from cps_item) group by 1, 2;

create temp table cps_adj as
  select pq.item_id, pq.store_id as adj_store, sum(pq.qty)::numeric as qty
    from product_qtychange pq
   where pq.active and not pq.archive and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.item_id in (select item_id from cps_item) group by 1, 2;

create temp table cps_bal as
  select i.*, coalesce((select sum(qty) from cps_sold s where s.item_id = i.item_id), 0) as sold_total,
         coalesce((select sum(qty) from cps_adj a where a.item_id = i.item_id), 0) as adj_total,
         coalesce((select sum(qty) from cps_sold s where s.item_id = i.item_id and s.sale_store is not distinct from i.inv_store), 0) as sold_at_inv_store,
         i.purchased - coalesce((select sum(qty) from cps_sold s where s.item_id = i.item_id), 0) + coalesce((select sum(qty) from cps_adj a where a.item_id = i.item_id), 0) as balance
    from cps_item i;

\echo
\echo ================================================================  1. the Stock screen number, and what it leaves out (all stores together)
select count(*) as batches,
       sum(balance) filter (where not near_expired) as stock_screen_avail,
       sum(balance) filter (where near_expired) as expired_or_near_expiry_balance,
       sum(balance) as all_batches_together,
       count(*) filter (where balance < 0) as batches_below_zero,
       sum(balance) filter (where balance < 0) as total_of_those_below_zero,
       sum(balance) filter (where balance > 0) as total_of_those_above_zero
  from cps_bal;

\echo
\echo ================================================================  2. the Reorder number, store by store (purchases at the store - sales at the store + its adjustments)
with st as (
  select inv_store as store_id from cps_item union select sale_store from cps_sold union select adj_store from cps_adj
)
select coalesce(s.location, '(no store)') as store, st.store_id,
       coalesce((select sum(purchased) from cps_item i where i.inv_store is not distinct from st.store_id), 0) as bought_here,
       coalesce((select sum(qty) from cps_sold x where x.sale_store is not distinct from st.store_id), 0) as sold_here,
       coalesce((select sum(qty) from cps_adj x where x.adj_store is not distinct from st.store_id), 0) as adjusted_here,
       coalesce((select sum(purchased) from cps_item i where i.inv_store is not distinct from st.store_id), 0)
         - coalesce((select sum(qty) from cps_sold x where x.sale_store is not distinct from st.store_id), 0)
         + coalesce((select sum(qty) from cps_adj x where x.adj_store is not distinct from st.store_id), 0) as reorder_stock
  from st left join stores s on s.id = st.store_id order by st.store_id;

\echo
\echo ================================================================  3. the batches pulling the stock down (most negative first)
select b.item_id, b.invoice_no as invoice, b.invoice_status as inv_status, left(coalesce(s.location, '-'), 14) as bought_at, b.batch, to_char(b.exp_date, 'YYYY-MM') as expiry,
       case when b.near_expired then 'yes' else '' end as expired, b.purchased, b.sold_total as sold, b.sold_at_inv_store as sold_where_bought, b.sold_total - b.sold_at_inv_store as sold_elsewhere,
       b.adj_total as adjusted, b.balance
  from cps_bal b left join stores s on s.id = b.inv_store where b.balance < 0 order by b.balance limit 15;

\echo
\echo Reading it: section 1 stock_screen_avail is the Stock screen Avail. The Reorder number for a store is in section 2.
\echo - A big negative in expired_or_near_expiry_balance means old batches were sold more than was bought: the Stock screen hides them, Reorder does not.
\echo - sold_elsewhere > 0 means a batch bought at one store was sold at another: Reorder counts the sale at the selling store but the purchase only at the buying store.
\echo - A purchased far below sold on a batch usually means a purchase was entered in packs and sold in units (or not entered at all).
SQL
