#!/usr/bin/env bash
# Checks the totals of purchase invoices against their lines. READ ONLY: it runs SELECTs and changes nothing.
#
#   bash scripts/check-invoice-totals.sh                 every invoice that is not archived: a summary and the 25 furthest out
#   bash scripts/check-invoice-totals.sh 12345 SE-88     the lines and figures of those invoice numbers (a number or part of it)
#   bash scripts/check-invoice-totals.sh --all           the summary and every invoice that is out, not only 25
#
# Two kinds of invoice are told apart by what the stored line totals are (summed over the lines still part of the invoice):
#   PRETAX     the sum of the line totals is qty x rate x (1 - discount): the amount BEFORE tax (what the item form and the invoice reading store).
#              The GST has to be added on top, so the invoice should come to the lines plus their GST.
#   INCLUSIVE  the sum is that amount WITH each line's GST in it (older, migrated invoices): the total and the GST split are already right.
#   OTHER      it matches neither: the invoice was edited or entered oddly, and is listed for a person to look at.
# Columns:
#   lines_pre_tax   the sum of the stored line totals            lines_with_tax  the same with each line's GST added on top (PRETAX reading)
#   net_to_pay      what the invoice should come to (PRETAX: lines + GST; INCLUSIVE: the lines as they are), less any cash discount, to the rupee
#   stored_total    purchase_invoice.total (the Payments panel and payables use it: balance = stored_total - paid)
#   stored_taxable  the taxable value kept for GST (should be the lines before tax)
#   calc_from_rates qty x rate x (1 - discount), the check that decides PRETAX / INCLUSIVE / OTHER
# Flags: gst = taxable value is wrong; total = stored total is not what it should be; other = needs a look; paper = printed total differs.
# Fix what is wrong with:  bash scripts/fix-invoice-totals.sh   (a dry run first)
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
         coalesce(sum(x.total), 0)::numeric as goods,
         coalesce(sum(x.total * (1 + coalesce(x.tax_pcnt, 0) / 100.0)), 0)::numeric as gross,
         coalesce(sum(x.total / (1 + coalesce(x.tax_pcnt, 0) / 100.0)), 0)::numeric as taxable_if_inclusive,
         coalesce(sum(x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0)), 0)::numeric as calc_goods,
         coalesce(sum(x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0) * (1 + coalesce(x.tax_pcnt, 0) / 100.0)), 0)::numeric as calc_gross,
         count(x.id)::int as n
    from purchase_invoice i
    left join purchase_invoice_item x on x.invoice_id = i.id and x.active and not x.archive and x.status not in ('DISPUTED', 'REJECTED')
   where i.active and not i.archive
   group by i.id
), paid as (
  select invoice_id, coalesce(sum(amount), 0)::numeric as paid,
         bool_and(trans_ref = 'MIGRATION-OPENING') as only_opening
    from vendor_payment where active and not archive group by invoice_id
), typed as (
  select l.*, case when l.n = 0 then 'NONE'
                   when abs(l.goods - l.calc_goods) <= greatest(1, 0.003 * l.calc_goods) then 'PRETAX'
                   when abs(l.goods - l.calc_gross) <= greatest(1, 0.003 * l.calc_gross) then 'INCLUSIVE'
                   else 'OTHER' end as basis
    from lines l
), fig as (
  select i.id, coalesce(i.invoice_no, 'challan ' || i.challan_no) as no, i.status, v.business_name as vendor, i.invoice_date, t.n, t.basis,
         round(t.goods, 2) as lines_pre_tax, round(t.gross, 2) as lines_with_tax, round(t.calc_goods, 2) as calc_from_rates,
         coalesce(i.cash_discount, 0)::numeric as cash_discount,
         case when t.basis = 'PRETAX' then round(case when coalesce(i.cash_discount, 0) > 0 and t.goods > i.cash_discount then t.gross * (t.goods - i.cash_discount::numeric) / t.goods else t.gross end, 0)
              when t.basis = 'INCLUSIVE' then round(case when coalesce(i.cash_discount, 0) > 0 and t.goods > i.cash_discount then t.goods - i.cash_discount::numeric else t.goods end, 0)
              else null end as net_to_pay,
         round(coalesce(i.total, 0)::numeric, 2) as stored_total,
         round(coalesce(i.taxable_value, 0)::numeric, 2) as stored_taxable,
         round(case when t.basis = 'INCLUSIVE' then t.taxable_if_inclusive else t.goods end, 2) as taxable_should_be,
         round(coalesce(i.cgst_amount, 0)::numeric + coalesce(i.sgst_amount, 0)::numeric + coalesce(i.igst_amount, 0)::numeric, 2) as stored_gst,
         round(case when t.basis = 'INCLUSIVE' then t.goods - t.taxable_if_inclusive else t.gross - t.goods end, 2) as gst_should_be,
         i.printed_total::numeric as printed,
         coalesce(p.paid, 0) as paid, coalesce(p.only_opening, false) as only_opening,
         greatest(0, coalesce(i.total, 0)::numeric - coalesce(p.paid, 0)) as balance_shown
    from purchase_invoice i join typed t on t.id = i.id left join paid p on p.invoice_id = i.id left join vendor v on v.id = i.vendor_id
   where i.active and not i.archive
), flagged as (
  select f.*,
         (f.basis in ('PRETAX', 'INCLUSIVE') and abs(f.stored_taxable - f.taxable_should_be) > 1) as gst_split_off,
         (f.basis in ('PRETAX', 'INCLUSIVE') and abs(f.stored_total - f.net_to_pay) > 1) as total_not_net,
         (f.basis = 'OTHER') as needs_look,
         (f.printed is not null and f.net_to_pay is not null and abs(f.printed - f.net_to_pay) > 1) as printed_differs,
         coalesce(abs(f.stored_total - f.net_to_pay), 0) as gap
    from fig f
)
"

if [ ${#numbers[@]} -gt 0 ]; then
  for n in "${numbers[@]}"; do
    safe="${n//\'/}"
    echo "=================================================================  invoice matching '$safe'"
    $PSQL -P pager=off -x -c "$FIGURES
select id, no, status, vendor, invoice_date, n as lines, basis,
       lines_pre_tax, lines_with_tax, calc_from_rates, cash_discount, net_to_pay, printed as printed_on_paper,
       stored_total, stored_taxable, taxable_should_be, stored_gst, gst_should_be,
       paid, only_opening as paid_only_by_opening_entry, balance_shown, (net_to_pay - stored_total) as net_minus_stored,
       gst_split_off, total_not_net, needs_look, printed_differs
  from flagged where upper(no) like upper('%$safe%') order by id desc limit 5;"
    echo "--- its lines (qty x rate, discount, GST, the stored line total, and the item's taxable value)"
    $PSQL -P pager=off -c "
select p.title as product, x.qty, x.free_qty as free, x.ptr_value as rate, x.disc_pcnt as disc, x.tax_pcnt as tax,
       round((x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0))::numeric, 2) as qty_x_rate,
       round((x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0) * (1 + coalesce(x.tax_pcnt, 0) / 100.0))::numeric, 2) as with_tax,
       round(x.total::numeric, 2) as stored_total, round(coalesce(x.taxable_value, 0)::numeric, 2) as stored_taxable, x.status
  from purchase_invoice_item x join purchase_invoice i on i.id = x.invoice_id join product p on p.id = x.product_id
 where upper(coalesce(i.invoice_no, 'challan ' || i.challan_no)) like upper('%$safe%') and x.active and not x.archive order by x.id;"
  done
  exit 0
fi

echo "=================================================================  summary (read only)"
$PSQL -P pager=off -c "$FIGURES
select basis, count(*) as invoices,
       count(*) filter (where gst_split_off) as gst_split_off,
       count(*) filter (where total_not_net) as total_not_right,
       count(*) filter (where printed_differs) as printed_differs,
       round(sum(net_to_pay - stored_total) filter (where total_not_net), 2) as net_minus_stored_total
  from flagged group by basis order by basis;"

echo
echo "=================================================================  by status: invoices whose total is not right (PRETAX and INCLUSIVE only)"
$PSQL -P pager=off -c "$FIGURES
select status, basis, count(*) as invoices, round(sum(net_to_pay - stored_total), 2) as net_minus_stored,
       count(*) filter (where paid > 0 and only_opening) as paid_by_opening_entry, count(*) filter (where paid > 0 and not only_opening) as with_real_payments
  from flagged where total_not_net group by status, basis order by status, basis;"

echo
echo "=================================================================  the invoices furthest out (stored total vs what it should be)"
$PSQL -P pager=off -c "$FIGURES
select id, no, status, basis, left(vendor, 22) as vendor, invoice_date as date, n as lines, lines_pre_tax, net_to_pay, printed as paper, stored_total, stored_taxable, paid,
       round(net_to_pay - stored_total, 2) as net_minus_stored,
       concat_ws(',', case when gst_split_off then 'gst' end, case when total_not_net then 'total' end, case when printed_differs then 'paper' end) as flags
  from flagged where total_not_net or gst_split_off order by gap desc, id desc limit $limit;"

echo
echo "=================================================================  line totals that match neither reading (a person has to look; the fix leaves them alone)"
$PSQL -P pager=off -c "$FIGURES
select id, no, status, left(vendor, 22) as vendor, invoice_date as date, n as lines, lines_pre_tax, calc_from_rates, lines_with_tax, stored_total, paid
  from flagged where needs_look order by abs(lines_pre_tax - calc_from_rates) desc limit 15;"

echo
echo "Reading it: net_minus_stored > 0 means the balance owed is shown too low. PRETAX invoices need the GST added; INCLUSIVE invoices are already right"
echo "(they only show here if their stored total or GST split is off). paid_by_opening_entry = paid only by the one-off settlement entry made when the old invoices were"
echo "settled at the cutover, not by a real payment. Look at one invoice closely:  bash scripts/check-invoice-totals.sh <invoice number>"
echo "Put right what is wrong:  bash scripts/fix-invoice-totals.sh   (a dry run first)"
