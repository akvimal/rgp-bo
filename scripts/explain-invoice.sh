#!/usr/bin/env bash
# Explains why a purchase invoice's total, balance or overdue figure is what it is. READ ONLY: it runs SELECTs and changes nothing.
#
#   bash scripts/explain-invoice.sh MG-26-174423            one invoice number (or part of it, or a challan number)
#   bash scripts/explain-invoice.sh MG-26-174423 SE-88      several
#
# For each invoice it prints:
#   1. the figures side by side: net total entered (printed), lines total (before tax, and with GST), credits, what is payable, the stored total,
#      what has been paid, and the balance each way (from the stored total, which is what the lists use, and from what is payable)
#   2. the REASONS: every way the figures disagree, in plain words, and what to do about it
#   3. its lines (rate, discount, GST, the stored line total) and its payments
#
# What is payable (the rule the Payments panel now uses):
#   with a net total entered:  net total + (lines now - lines when billed) - credits      (the net total as entered, nothing rounded)
#   with none entered:         lines with GST (less any cash discount) - credits, to the paisa
# Overdue is not part of payment status: an invoice is late when it is past its due date with a balance, and that is shown separately.
#
# Which database: by default the beta (compose project rgp-beta). To check another, set PSQL to the command that opens psql, for example
#   PSQL="docker exec -i some-db psql -U user -d dbname" bash scripts/explain-invoice.sh MG-26-174423
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then echo "Give at least one invoice number, e.g.  bash scripts/explain-invoice.sh MG-26-174423"; exit 1; fi

PROJECT="${PROJECT:-rgp-beta}"
USER_="${POSTGRES_USER:-rgpapp}"
DB_="${POSTGRES_DB:-rgpbeta}"
if [ -z "${PSQL:-}" ]; then
  COMPOSE="docker compose -p $PROJECT -f docker-compose.beta.yml --env-file .env.beta"
  [ -n "${BETA_EDGE_NETWORK:-}" ] && COMPOSE="$COMPOSE -f docker-compose.beta.yml -f docker-compose.beta.edge.yml"
  PSQL="$COMPOSE exec -T db psql -U $USER_ -d $DB_"
fi

# every figure for the matching invoices, once
FIGURES="
with inv as (
  select i.*, coalesce(i.cash_discount, 0)::numeric as cd from purchase_invoice i
   where i.active and not i.archive
     and (upper(coalesce(i.invoice_no, '')) like upper('%@N@%') or upper(coalesce(i.challan_no, '')) like upper('%@N@%'))
), live as (   -- lines still part of the invoice: not in dispute and not rejected
  select x.invoice_id, count(*)::int as n,
         coalesce(sum(x.total::numeric), 0) as goods,
         coalesce(sum(x.total::numeric * (1 + coalesce(x.tax_pcnt, 0)::numeric / 100.0)), 0) as gross
    from purchase_invoice_item x where x.active and not x.archive and x.status not in ('DISPUTED', 'REJECTED') group by x.invoice_id
), billed as ( -- lines as billed: rejected lines count at what they were billed
  select x.invoice_id,
         coalesce(sum(case when x.status = 'REJECTED' then coalesce(x.rejected_total, 0)::numeric else x.total::numeric end), 0) as goods,
         coalesce(sum(case when x.status = 'REJECTED' then coalesce(x.rejected_total, 0)::numeric else x.total::numeric end * (1 + coalesce(x.tax_pcnt, 0)::numeric / 100.0)), 0) as gross
    from purchase_invoice_item x where x.active and not x.archive and x.status <> 'DISPUTED' group by x.invoice_id
), odd as (    -- lines whose stored total is not qty x rate x (1 - discount)
  select x.invoice_id, count(*)::int as n
    from purchase_invoice_item x where x.active and not x.archive and x.status not in ('DISPUTED', 'REJECTED')
     and abs(x.total::numeric - x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0)) > greatest(0.06, 0.003 * x.total::numeric) group by x.invoice_id
), rate_calc as (   -- the same lines worked out again from qty x rate x (1 - discount), then GST
  select x.invoice_id,
         coalesce(sum(round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0), 2)), 0) as goods,
         coalesce(sum(round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0), 2) * (1 + coalesce(x.tax_pcnt, 0)::numeric / 100.0)), 0) as gross
    from purchase_invoice_item x where x.active and not x.archive and x.status not in ('DISPUTED', 'REJECTED') group by x.invoice_id
), held as (
  select x.invoice_id, count(*) filter (where x.status = 'DISPUTED')::int as disputed, count(*) filter (where x.status = 'REJECTED')::int as rejected
    from purchase_invoice_item x where x.active and not x.archive group by x.invoice_id
), cr as (
  select invoice_id, coalesce(sum(amount), 0)::numeric as credits from purchase_invoice_credit where active group by invoice_id
), pay as (
  select invoice_id, coalesce(sum(amount), 0)::numeric as paid, count(*)::int as entries, count(*) filter (where amount < 0)::int as reversals
    from vendor_payment where invoice_id in (select id from inv) and active and not archive group by invoice_id
), f as (
  select i.id, coalesce(i.invoice_no, 'challan ' || i.challan_no) as no, v.business_name as vendor, i.status, coalesce(i.payment_status, 'Unpaid') as stored_status,
         i.invoice_date, coalesce(i.due_date, i.invoice_date) as due_date,
         i.printed_total::numeric as printed, coalesce(i.cash_discount, 0)::numeric as cash_discount,
         coalesce(l.n, 0) as n, round(coalesce(rc.goods, 0), 2) as from_rates_pre_tax, round(coalesce(rc.gross, 0), 2) as from_rates_with_gst, round(coalesce(l.goods, 0), 2) as lines_pre_tax, round(coalesce(l.gross, 0), 2) as lines_with_gst,
         round(case when i.cd > 0 and coalesce(l.goods, 0) > i.cd then coalesce(l.gross, 0) * (l.goods - i.cd) / l.goods else coalesce(l.gross, 0) end, 2) as lines_net,
         round(case when i.cd > 0 and coalesce(b.goods, 0) > i.cd then coalesce(b.gross, 0) * (b.goods - i.cd) / b.goods else coalesce(b.gross, 0) end, 2) as billed_net,
         coalesce(c.credits, 0) as credits,
         round(coalesce(i.total, 0)::numeric, 2) as stored_total,
         round(coalesce(i.taxable_value, 0)::numeric + coalesce(i.cgst_amount, 0)::numeric + coalesce(i.sgst_amount, 0)::numeric + coalesce(i.igst_amount, 0)::numeric + coalesce(i.round_off, 0)::numeric, 2) as header_parts,
         coalesce(p.paid, 0) as paid, coalesce(p.entries, 0) as pay_entries, coalesce(p.reversals, 0) as pay_reversals,
         coalesce(o.n, 0) as odd_lines, coalesce(h.disputed, 0) as disputed, coalesce(h.rejected, 0) as rejected
    from inv i left join vendor v on v.id = i.vendor_id left join live l on l.invoice_id = i.id left join billed b on b.invoice_id = i.id
    left join rate_calc rc on rc.invoice_id = i.id left join odd o on o.invoice_id = i.id left join held h on h.invoice_id = i.id left join cr c on c.invoice_id = i.id left join pay p on p.invoice_id = i.id
), g as (
  select f.*,
         case when f.printed > 0 then round(greatest(0, f.printed + (f.lines_net - f.billed_net) - f.credits), 2)
              else round(greatest(0, f.lines_net - f.credits), 2) end as payable
    from f
), h2 as (
  select g.*, round(greatest(0, g.stored_total - g.paid), 2) as balance_stored, round(greatest(0, g.payable - g.paid), 2) as balance_payable,
         (current_date - g.due_date) as days_past_due
    from g
)
"

for n in "$@"; do
  safe="${n//\'/}"
  echo "=================================================================  invoice matching '$safe'"
  $PSQL -P pager=off -x -c "${FIGURES//@N@/$safe}
select id, no, vendor, status, stored_status as stored_payment_status, invoice_date, due_date,
       printed as net_total_entered, cash_discount, n as live_lines, lines_pre_tax as stored_lines_pre_tax, lines_with_gst as stored_lines_with_gst, from_rates_pre_tax, from_rates_with_gst, lines_net as lines_net_of_cash_discount, billed_net, credits,
       payable as payable_now, stored_total, header_parts as header_gst_parts_plus_roundoff,
       paid, balance_stored as balance_from_stored_total, balance_payable as balance_from_payable
  from h2 order by id desc limit 5;"

  echo "--- REASONS"
  $PSQL -P pager=off -t -A -c "${FIGURES//@N@/$safe}
select '[' || id || ' ' || no || '] ' || reason from (
  select id, no, 1 as ord, 'No net total was entered, so the amount owed comes from the lines (' || lines_net || '). Enter the net total from the vendor invoice.' as reason from h2 where printed is null or printed <= 0
  union all select id, no, 2, 'The stored total (' || stored_total || ') differs from what is payable (' || payable || ') by ' || round(payable - stored_total, 2) || '. The lists use the stored total, so their balance is off by that. Fix: as Business Head run Check totals (preview, then fix) or  POST /purchases/total-fix.' from h2 where abs(stored_total - payable) > 0.005
  union all select id, no, 3, 'The stored total is the payable amount rounded to the rupee (' || stored_total || ' vs ' || payable || '): an older rule. Check totals puts it to the paisa.' from h2 where abs(stored_total - payable) > 0.005 and abs(stored_total - round(payable)) < 0.005
  union all select id, no, 4, 'The lines come to ' || billed_net || ' but the net total entered is ' || printed || ' (' || abs(round(billed_net - printed, 2)) || CASE WHEN billed_net > printed THEN ' more' ELSE ' less' END || '). More than Rs 1 apart means a missing, repeated or mistyped line, or a wrong net total. Payable follows the net total entered.' from h2 where printed > 0 and abs(billed_net - printed) > 1.0001
  union all select id, no, 5, odd_lines || ' line(s) have a stored total that is not qty x rate x (1 - discount). Worked out from the rates the invoice comes to ' || from_rates_with_gst || ' with GST (' || from_rates_pre_tax || ' before tax), but the stored line totals give ' || lines_with_gst || ' (' || lines_pre_tax || ' before tax): ' || round(from_rates_with_gst - lines_with_gst, 2) || ' apart. The lines are listed next.' from h2 where odd_lines > 0
  union all select h2.id, h2.no, 5, '  line ' || p.title || ': stored ' || round(x.total::numeric, 2) || ', qty ' || x.qty || ' x rate ' || x.ptr_value || ' less ' || coalesce(x.disc_pcnt, 0) || '% = ' || round(x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0), 2) || ' (' || CASE WHEN abs(x.total::numeric - x.qty * x.ptr_value::numeric) < 0.01 THEN 'the discount was not taken off' ELSE 'differs by ' || round(x.total::numeric - x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0), 2) END || ')'
    from h2 join purchase_invoice_item x on x.invoice_id = h2.id and x.active and not x.archive and x.status not in ('DISPUTED', 'REJECTED') join product p on p.id = x.product_id
   where abs(x.total::numeric - x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0)) > greatest(0.06, 0.003 * x.total::numeric)
  union all select id, no, 6, disputed || ' line(s) in dispute and ' || rejected || ' rejected are left out of the lines total until accepted or dropped.' from h2 where disputed > 0 or rejected > 0
  union all select id, no, 7, 'The header GST parts plus round-off (' || header_parts || ') do not add up to the stored total (' || stored_total || '): the GST split is stale. Check totals refreshes it.' from h2 where status = 'COMPLETE' and abs(header_parts - stored_total) > 0.02
  union all select id, no, 8, 'Credits of ' || credits || ' (vendor returns) are taken off what was bought.' from h2 where credits > 0
  union all select id, no, 9, pay_reversals || ' reversal entr' || CASE WHEN pay_reversals = 1 THEN 'y' ELSE 'ies' END || ' among ' || pay_entries || ' payment entries: paid ' || paid || ' is the net of payments and reversals.' from h2 where pay_reversals > 0
  union all select id, no, 10, 'Paid (' || paid || ') is more than payable (' || payable || '): overpaid by ' || round(paid - payable, 2) || '.' from h2 where paid - payable > 1.005
  union all select id, no, 11, 'Past its due date (' || due_date || ', ' || days_past_due || ' days) with ' || balance_payable || ' still to pay: LATE. This is shown as late, not as a payment status. Stored payment status is ' || stored_status || '.' from h2 where status = 'COMPLETE' and days_past_due > 0 and balance_payable > 0.005 and stored_status <> 'On Hold'
  union all select id, no, 12, 'Stored payment status says Overdue (' || stored_status || '): an old value; the app no longer derives it.' from h2 where stored_status = 'Overdue'
  union all select id, no, 13, 'The invoice is not complete (' || status || '): payments cannot be recorded until it is completed.' from h2 where status <> 'COMPLETE'
  union all select id, no, 99, 'Stored total, payable and the lines agree.' from h2 where abs(stored_total - payable) <= 0.005 and (printed is null or abs(billed_net - printed) <= 1.0001) and odd_lines = 0
) r order by id desc, ord;"

  echo "--- its lines"
  $PSQL -P pager=off -c "
select p.title as product, x.qty, x.free_qty as free, x.ptr_value as rate, x.disc_pcnt as disc, x.tax_pcnt as tax,
       round((x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0))::numeric, 2) as qty_x_rate,
       round(x.total::numeric, 2) as stored_line_total,
       round(x.total::numeric - x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0), 2) as stored_minus_worked_out,
       case when abs(x.total::numeric - x.qty * x.ptr_value::numeric * (1 - coalesce(x.disc_pcnt, 0)::numeric / 100.0)) > greatest(0.06, 0.003 * x.total::numeric) then '<< OFF' else '' end as flag, x.status
  from purchase_invoice_item x join purchase_invoice i on i.id = x.invoice_id join product p on p.id = x.product_id
 where upper(coalesce(i.invoice_no, '')) like upper('%$safe%') and x.active and not x.archive order by x.id;"

  echo "--- its payments"
  $PSQL -P pager=off -c "
select pay.id, pay.pay_date, pay.amount, pay.pay_mode, pay.trans_ref, pay.status
  from vendor_payment pay join purchase_invoice i on i.id = pay.invoice_id
 where upper(coalesce(i.invoice_no, '')) like upper('%$safe%') and pay.active and not pay.archive order by pay.id;"
done
