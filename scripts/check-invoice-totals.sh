#!/usr/bin/env bash
# Checks the totals of purchase invoices against their lines. READ ONLY: it runs SELECTs and changes nothing.
#
#   bash scripts/check-invoice-totals.sh                 every invoice that is not archived: a summary and the 25 furthest out
#   bash scripts/check-invoice-totals.sh 12345 SE-88     the lines and figures of those invoice numbers (a number or part of it)
#   bash scripts/check-invoice-totals.sh --all           the summary and every invoice that is out, not only 25
#
# What it compares, for each invoice:
#   lines_pre_tax   qty x rate x (1 - discount), summed over the lines still part of the invoice (not disputed, not rejected)
#   lines_with_tax  the same with each line's GST added: what the items page calls Net total
#   net_to_pay      lines_with_tax less the cash discount, rounded: what the invoice should come to
#   stored_total    purchase_invoice.total, which the Payments panel and payables use (balance = stored_total - paid)
#   stored_taxable  the taxable value kept on the invoice for GST (should equal lines_pre_tax)
#
# Which database: by default the beta (compose project rgp-beta). To check another, set PSQL to the command that opens psql, for example
#   PSQL="docker exec -i some-db psql -U user -d dbname" bash scripts/check-invoice-totals.sh
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

limit=25; numbers=()
for a in "$@"; do
  case "$a" in
    --all) limit=100000 ;;
    *) numbers+=("$a") ;;
  esac
done

# every figure per invoice, once, so the summary and the list read the same numbers
FIGURES="
with lines as (
  select i.id,
         coalesce(sum(x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0)), 0)::numeric as pre_tax,
         coalesce(sum(x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0) * (1 + coalesce(x.tax_pcnt, 0) / 100.0)), 0)::numeric as with_tax,
         coalesce(sum(x.total), 0)::numeric as stored_line_total,
         count(x.id)::int as n
    from purchase_invoice i
    left join purchase_invoice_item x on x.invoice_id = i.id and x.active and not x.archive and x.status not in ('DISPUTED', 'REJECTED')
   where i.active and not i.archive
   group by i.id
), paid as (
  select invoice_id, coalesce(sum(amount), 0)::numeric as paid from vendor_payment where active and not archive group by invoice_id
), fig as (
  select i.id, coalesce(i.invoice_no, 'challan ' || i.challan_no) as no, i.status, v.business_name as vendor, i.invoice_date,
         l.n, round(l.pre_tax, 2) as lines_pre_tax, round(l.with_tax, 2) as lines_with_tax,
         round(l.with_tax - coalesce(i.cash_discount, 0)::numeric, 0) as net_to_pay,
         round(coalesce(i.total, 0)::numeric, 2) as stored_total,
         round(l.stored_line_total, 2) as stored_lines_sum,
         round(coalesce(i.taxable_value, 0)::numeric, 2) as stored_taxable,
         round(coalesce(i.cgst_amount, 0)::numeric + coalesce(i.sgst_amount, 0)::numeric + coalesce(i.igst_amount, 0)::numeric, 2) as stored_gst,
         round(l.with_tax - l.pre_tax, 2) as gst_should_be,
         i.printed_total::numeric as printed, coalesce(i.cash_discount, 0)::numeric as cash_discount,
         coalesce(p.paid, 0) as paid,
         greatest(0, coalesce(i.total, 0)::numeric - coalesce(p.paid, 0)) as balance_shown
    from purchase_invoice i join lines l on l.id = i.id left join paid p on p.invoice_id = i.id left join vendor v on v.id = i.vendor_id
   where i.active and not i.archive
), flagged as (
  select f.*,
         (f.n > 0 and abs(f.stored_taxable - f.lines_pre_tax) > 1) as gst_split_off,
         (f.n > 0 and abs(f.stored_total - f.net_to_pay) > 1) as total_not_net,
         (f.n > 0 and abs(f.stored_total - f.stored_lines_sum) > 1) as total_stale,
         (f.printed is not null and f.n > 0 and abs(f.printed - f.net_to_pay) > 1) as printed_differs,
         abs(f.stored_total - f.net_to_pay) as gap
    from fig f
)
"

if [ ${#numbers[@]} -gt 0 ]; then
  for n in "${numbers[@]}"; do
    safe="${n//\'/}"
    echo "=================================================================  invoice matching '$safe'"
    $PSQL -P pager=off -x -c "$FIGURES
select id, no, status, vendor, invoice_date, n as lines,
       lines_pre_tax, lines_with_tax, cash_discount, net_to_pay, printed as printed_on_paper,
       stored_total, stored_lines_sum, stored_taxable, stored_gst, gst_should_be,
       paid, balance_shown, (stored_total - net_to_pay) as stored_minus_net,
       gst_split_off, total_not_net, total_stale, printed_differs
  from flagged where upper(no) like upper('%$safe%') order by id desc limit 5;"
    echo "--- its lines (qty x rate, discount, GST, the stored line total, and the item's taxable value)"
    $PSQL -P pager=off -c "
select p.title as product, x.qty, x.free_qty as free, x.ptr_value as rate, x.disc_pcnt as disc, x.tax_pcnt as tax,
       round((x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0))::numeric, 2) as pre_tax,
       round((x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0) * (1 + coalesce(x.tax_pcnt, 0) / 100.0))::numeric, 2) as with_tax,
       round(x.total::numeric, 2) as stored_total, round(coalesce(x.taxable_value, 0)::numeric, 2) as stored_taxable, x.status
  from purchase_invoice_item x join purchase_invoice i on i.id = x.invoice_id join product p on p.id = x.product_id
 where upper(coalesce(i.invoice_no, 'challan ' || i.challan_no)) like upper('%$safe%') and x.active and not x.archive order by x.id;"
  done
  exit 0
fi

echo "=================================================================  summary (read only)"
$PSQL -P pager=off -c "$FIGURES
select count(*) as invoices,
       count(*) filter (where n = 0) as with_no_lines,
       count(*) filter (where gst_split_off) as gst_split_off,
       count(*) filter (where total_not_net) as total_not_net_to_pay,
       count(*) filter (where total_stale) as total_differs_from_lines,
       count(*) filter (where printed_differs) as printed_differs_from_lines,
       round(sum(stored_total) filter (where total_not_net), 2) as stored_total_of_those,
       round(sum(net_to_pay) filter (where total_not_net), 2) as net_to_pay_of_those,
       round(sum(net_to_pay - stored_total) filter (where total_not_net), 2) as understated_by
  from flagged;"

echo
echo "=================================================================  by status (invoices whose stored total is not the net to pay)"
$PSQL -P pager=off -c "$FIGURES
select status, count(*) as invoices, round(sum(net_to_pay - stored_total), 2) as net_minus_stored,
       count(*) filter (where paid > 0) as with_payments, count(*) filter (where gst_split_off) as gst_split_off
  from flagged where total_not_net group by status order by status;"

echo
echo "=================================================================  the invoices furthest out (stored total vs net to pay)"
$PSQL -P pager=off -c "$FIGURES
select id, no, status, left(vendor, 22) as vendor, invoice_date as date, n as lines, lines_pre_tax, lines_with_tax, net_to_pay, printed as paper, stored_total, stored_taxable, paid,
       round(net_to_pay - stored_total, 2) as net_minus_stored,
       concat_ws(',', case when gst_split_off then 'gst' end, case when total_stale then 'stale' end, case when printed_differs then 'paper' end) as flags
  from flagged where total_not_net order by gap desc, id desc limit $limit;"

echo
echo "Reading it: net_minus_stored > 0 means the balance owed is shown too low. flags: gst = taxable value is not the pre-tax lines;"
echo "stale = the stored total is not even the sum of the stored line totals; paper = the total printed on the invoice differs from the net to pay."
echo "Look at one invoice closely:  bash scripts/check-invoice-totals.sh <invoice number>"
