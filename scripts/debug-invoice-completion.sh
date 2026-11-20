#!/usr/bin/env bash
# Why does completing an invoice say "The lines come to Rs X but the net total of the invoice is Rs Y"? READ ONLY: SELECTs only.
#
#   bash scripts/debug-invoice-completion.sh IN19936
#
# It repeats the exact sum the completion check makes (purchase-invoice.service.ts assertPrintedAgrees -> billedNet -> invoiceNet):
#   lines counted: active, not archived, status <> 'DISPUTED';  a REJECTED line counts at rejected_total, any other at total
#   each counted total x (1 + tax%) summed, then scaled by the cash discount factor
# and then shows what could make that differ from the vendor invoice:
#   1. header figures (net total entered, cash discount, status)
#   2. every line row, including ones the check ignores (inactive / archived / disputed), with stored total vs qty x rate x (1 - disc)
#   3. lines whose stored total does not match qty x rate x (1 - disc)
#   4. possible repeated lines (same product, batch, qty, rate)
#   5. the check's sum, and the sum if each variation applied (so you can see which one hits the net total)
#
# Which database: set PSQL to the command that opens psql on the VPS, for example
#   PSQL="docker exec -i rgp-db psql -U rgpapp -d rgpdb" bash scripts/debug-invoice-completion.sh IN19936
# Without PSQL it uses the beta stack (compose project rgp-beta), as the other scripts here do.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then echo "Give an invoice number, e.g.  bash scripts/debug-invoice-completion.sh IN19936"; exit 1; fi

PROJECT="${PROJECT:-rgp-beta}"
USER_="${POSTGRES_USER:-rgpapp}"
DB_="${POSTGRES_DB:-rgpbeta}"
if [ -z "${PSQL:-}" ]; then
  COMPOSE="docker compose -p $PROJECT -f docker-compose.beta.yml --env-file .env.beta"
  [ -n "${BETA_EDGE_NETWORK:-}" ] && COMPOSE="$COMPOSE -f docker-compose.beta.yml -f docker-compose.beta.edge.yml"
  PSQL="$COMPOSE exec -T db psql -U $USER_ -d $DB_"
fi

for NO in "$@"; do
  N="${NO//\'/}"   # no quotes in the number
  echo
  echo "################ $N ################"
  $PSQL -X -v ON_ERROR_STOP=1 <<SQL
\pset border 1
\pset null '-'

\echo === 1. invoice header ===
select i.id, i.invoice_no, i.challan_no, i.status, i.active, i.archive, i.vendor_id,
       i.printed_total::numeric(14,2) as net_total_entered, coalesce(i.cash_discount,0)::numeric(14,2) as cash_discount,
       i.total::numeric(14,2) as stored_total, i.payment_ready_on
  from purchase_invoice i
 where upper(i.invoice_no) like upper('%$N%') or upper(coalesce(i.challan_no,'')) like upper('%$N%');

\echo
\echo === 2. every line row (counted = what the completion check adds up) ===
select x.id, x.status, x.active, x.archive,
       case when x.active and not x.archive and x.status <> 'DISPUTED' then 'COUNTED' else 'ignored' end as in_check,
       left(coalesce(p.title, ''), 28) as item, x.batch, x.qty, x.ptr_value::numeric(14,4) as rate, x.disc_pcnt as disc, x.tax_pcnt as gst,
       x.total::numeric(14,2) as stored_total,
       round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt,0)::numeric/100), 2) as qty_x_rate,
       coalesce(x.rejected_total,0)::numeric(14,2) as rejected_total
  from purchase_invoice_item x
  join purchase_invoice i on x.invoice_id = i.id
  left join product p on p.id = x.product_id
 where upper(i.invoice_no) like upper('%$N%') or upper(coalesce(i.challan_no,'')) like upper('%$N%')
 order by x.id;

\echo
\echo === 3. counted lines whose stored total is not qty x rate x (1 - disc) (a mistyped or stale line) ===
select x.id, left(coalesce(p.title, ''), 28) as item, x.qty, x.ptr_value::numeric(14,4) as rate, x.disc_pcnt as disc,
       x.total::numeric(14,2) as stored_total,
       round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt,0)::numeric/100), 2) as qty_x_rate,
       (x.total::numeric - round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt,0)::numeric/100), 2))::numeric(14,2) as diff
  from purchase_invoice_item x
  join purchase_invoice i on x.invoice_id = i.id
  left join product p on p.id = x.product_id
 where (upper(i.invoice_no) like upper('%$N%') or upper(coalesce(i.challan_no,'')) like upper('%$N%'))
   and x.active and not x.archive and x.status <> 'DISPUTED'
   and abs(x.total::numeric - x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt,0)::numeric/100)) > 0.06;

\echo
\echo === 4. possible repeated lines (same product, batch, qty and rate more than once) ===
select x.product_id, x.batch, x.qty, x.ptr_value::numeric(14,4) as rate, count(*) as times, string_agg(x.id::text, ',') as line_ids
  from purchase_invoice_item x
  join purchase_invoice i on x.invoice_id = i.id
 where (upper(i.invoice_no) like upper('%$N%') or upper(coalesce(i.challan_no,'')) like upper('%$N%'))
   and x.active and not x.archive
 group by x.product_id, x.batch, x.qty, x.ptr_value having count(*) > 1;

\echo
\echo === 5. the check's sum and the variations (compare each to the net total entered) ===
with inv as (
  select i.id, i.invoice_no, i.printed_total::numeric as printed, coalesce(i.cash_discount,0)::numeric as cd
    from purchase_invoice i
   where upper(i.invoice_no) like upper('%$N%') or upper(coalesce(i.challan_no,'')) like upper('%$N%')
), c as (
  select inv.id, inv.invoice_no, inv.printed, inv.cd,
         coalesce(sum(case when x.status = 'REJECTED' then coalesce(x.rejected_total,0)::numeric else x.total::numeric end) filter (where x.active and not x.archive and x.status <> 'DISPUTED'), 0) as goods,
         coalesce(sum((case when x.status = 'REJECTED' then coalesce(x.rejected_total,0)::numeric else x.total::numeric end) * (1 + coalesce(x.tax_pcnt,0)::numeric/100)) filter (where x.active and not x.archive and x.status <> 'DISPUTED'), 0) as gross,
         coalesce(sum(x.total::numeric * (1 + coalesce(x.tax_pcnt,0)::numeric/100)) filter (where x.active and not x.archive and x.status = 'DISPUTED'), 0) as disputed_gross,
         coalesce(sum(coalesce(x.rejected_total,0)::numeric * (1 + coalesce(x.tax_pcnt,0)::numeric/100)) filter (where x.active and not x.archive and x.status = 'REJECTED'), 0) as rejected_gross,
         coalesce(sum(round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt,0)::numeric/100), 2) * (1 + coalesce(x.tax_pcnt,0)::numeric/100)) filter (where x.active and not x.archive and x.status <> 'DISPUTED'), 0) as gross_from_rate,
         coalesce(sum(x.total::numeric * (1 + coalesce(x.tax_pcnt,0)::numeric/100)) filter (where not x.active or x.archive), 0) as removed_gross
    from inv left join purchase_invoice_item x on x.invoice_id = inv.id
   group by inv.id, inv.invoice_no, inv.printed, inv.cd
)
select invoice_no,
       printed::numeric(14,2)                       as net_total_entered,
       round(gross, 2)                              as lines_with_gst_now,
       round(printed - gross, 2)                    as short_by,
       round(gross + disputed_gross, 2)             as if_disputed_counted,
       round(gross_from_rate, 2)                    as if_lines_from_qty_x_rate,
       round(gross + removed_gross, 2)              as if_removed_lines_counted,
       round(gross - (case when goods > 0 then cd / goods else 0 end) * gross, 2) as with_cash_discount_info_only
  from c;

\echo
\echo Reading it: short_by is the gap the message reports. Look for it among
\echo   - a line in section 2 marked ignored (inactive / archived / DISPUTED) whose value with GST is about the gap -> restore or count it
\echo   - a section 3 line whose diff is about the gap -> a mistyped line total
\echo   - if_lines_from_qty_x_rate close to the net total -> stored line totals are stale, re-save the lines
\echo   - if none fit: a line is missing from the invoice (compare the vendor paper copy to section 2), or the net total was typed wrongly
SQL
done
