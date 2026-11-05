#!/usr/bin/env bash
# Corrects the totals and the GST split of existing purchase invoices (see scripts/check-invoice-totals.sh for what is wrong).
# A line's stored total is its amount BEFORE tax; the GST used to be taken out of it as if it were inside, and the invoice total left GST out.
# This puts the existing invoices right the same way the app now works out new ones.
#
#   bash scripts/fix-invoice-totals.sh                 DRY RUN (the default): shows what would change and what is left alone; changes nothing
#   bash scripts/fix-invoice-totals.sh --apply         shows the plan, asks you to type APPLY, then changes the invoices (one transaction, with a backup)
#   bash scripts/fix-invoice-totals.sh --undo [batch]  puts back what a run changed (the latest run when no batch is given), for invoices not changed since
#   bash scripts/fix-invoice-totals.sh 12345           the plan for the invoices matching that number only (works with --apply too)
#
# What it changes, for an invoice with lines:
#   each line's taxable value and CGST/SGST/IGST   taxable = the line total, GST = taxable x rate (CGST and SGST halves, or IGST between states)
#   the invoice's taxable value, GST and round-off  the sums of its lines
#   the invoice total                               lines + their GST, less a cash discount, rounded to the rupee
# What it leaves alone (and lists): invoices with a payment recorded, invoices in a month already closed for GST, invoices with no lines,
# archived or inactive invoices, and invoices that already come out right.
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

mode=plan; batch=""; match=""; batch_given=0
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) mode=apply ;;
    --undo) mode=undo; if [ $# -gt 1 ] && [[ "$2" != --* ]]; then batch="$2"; batch_given=1; shift; fi ;;
    *) match="${1//\'/}" ;;
  esac
  shift
done
[ -z "$batch" ] && batch="fix-$(date +%Y%m%d-%H%M%S)"

# the plan: what every invoice should be, and why one is left alone. Built once, as temporary tables, so the report and the change read the same figures.
PLAN="
create temp table fx_item as
select x.id as item_id, x.invoice_id, i.supply_type, round(x.total::numeric, 2) as taxable, coalesce(x.tax_pcnt, 0)::numeric as pct,
       round(round(x.total::numeric, 2) * coalesce(x.tax_pcnt, 0)::numeric / 100, 2) as tax,
       (x.status not in ('DISPUTED', 'REJECTED')) as live, x.total::numeric as total,
       x.taxable_value as old_taxable, x.cgst_amount as old_cgst, x.sgst_amount as old_sgst, x.igst_amount as old_igst,
       null::numeric as cgst, null::numeric as sgst, null::numeric as igst
  from purchase_invoice_item x join purchase_invoice i on i.id = x.invoice_id
 where x.active and not x.archive and i.active and not i.archive;
update fx_item set cgst = case when supply_type = 'INTER' then 0 else round(tax / 2, 2) end, igst = case when supply_type = 'INTER' then tax else 0 end;
update fx_item set sgst = case when supply_type = 'INTER' then 0 else tax - cgst end;

create temp table fx_inv as
select i.id as invoice_id, coalesce(i.invoice_no, 'challan ' || i.challan_no) as no, i.status, v.business_name as vendor, i.invoice_date,
       coalesce(i.total, 0)::numeric as old_total, coalesce(i.taxable_value, 0)::numeric as old_taxable,
       (coalesce(i.cgst_amount, 0) + coalesce(i.sgst_amount, 0) + coalesce(i.igst_amount, 0))::numeric as old_gst,
       coalesce(i.round_off, 0)::numeric as old_roundoff,
       coalesce(sum(f.taxable) filter (where f.live), 0) as taxable,
       coalesce(sum(f.cgst) filter (where f.live), 0) as cgst, coalesce(sum(f.sgst) filter (where f.live), 0) as sgst, coalesce(sum(f.igst) filter (where f.live), 0) as igst,
       coalesce(sum(f.total) filter (where f.live), 0) as goods,
       coalesce(sum(f.total * (1 + f.pct / 100)) filter (where f.live), 0) as gross,
       coalesce(i.cash_discount, 0)::numeric as cd,
       (select count(*) from vendor_payment p where p.invoice_id = i.id and p.active and not p.archive) as payments,
       exists (select 1 from gst_filing_month m where m.business_id = s.business_id and m.status = 'CLOSED'
                and m.month = coalesce(i.gst_period, to_char(i.invoice_date, 'YYYY-MM'))) as gst_closed,
       null::numeric as new_total, null::numeric as new_roundoff, null::text as skip, false as changed
  from purchase_invoice i join fx_item f on f.invoice_id = i.id left join vendor v on v.id = i.vendor_id left join stores s on s.id = i.store_id
 where i.active and not i.archive $( if [ -n "$match" ]; then echo "and upper(coalesce(i.invoice_no, 'challan ' || i.challan_no)) like upper('%$match%')"; fi )
 group by i.id, v.business_name, s.business_id;
update fx_inv set new_total = round(case when cd > 0 and goods > cd then gross * (goods - cd) / goods else gross end, 0);
update fx_inv set new_roundoff = round(new_total - (taxable + cgst + sgst + igst), 2);
update fx_inv set changed = (abs(new_total - old_total) >= 0.5 or abs(taxable - old_taxable) > 0.01 or abs((cgst + sgst + igst) - old_gst) > 0.01);
update fx_inv set skip = case when goods = 0 then 'no lines' when payments > 0 then 'has payments' when gst_closed then 'GST month closed' end;
"

report() {
  $PSQL -q -v ON_ERROR_STOP=1 -P pager=off <<SQL
$PLAN
\echo ================================================================  the plan (nothing is changed by this)
select count(*) as invoices_with_lines,
       count(*) filter (where not changed) as already_right,
       count(*) filter (where changed and skip is null) as will_change,
       count(*) filter (where changed and skip = 'has payments') as left_has_payments,
       count(*) filter (where changed and skip = 'GST month closed') as left_gst_closed,
       count(*) filter (where changed and skip = 'no lines') as left_no_lines
  from fx_inv;
\echo
\echo ----------------------------------------------------------------  what it does to what you owe, for the invoices it would change
select status, count(*) as invoices, round(sum(old_total), 2) as total_now, round(sum(new_total), 2) as total_after, round(sum(new_total - old_total), 2) as change
  from fx_inv where changed and skip is null group by status order by status;
\echo
\echo ----------------------------------------------------------------  the invoices it would change (largest change first)
select invoice_id as id, no, status, left(vendor, 20) as vendor, invoice_date as date, old_total, new_total, round(new_total - old_total, 2) as change,
       old_taxable, round(taxable, 2) as taxable_after, old_gst, round(cgst + sgst + igst, 2) as gst_after
  from fx_inv where changed and skip is null order by abs(new_total - old_total) desc, invoice_id desc limit 30;
\echo
\echo ----------------------------------------------------------------  left alone because they need a decision (a payment, or a GST month already closed)
select invoice_id as id, no, status, left(vendor, 20) as vendor, invoice_date as date, skip as reason, old_total, new_total, round(new_total - old_total, 2) as change
  from fx_inv where changed and skip is not null and skip <> 'no lines' order by abs(new_total - old_total) desc limit 30;
SQL
}

case "$mode" in
  plan)
    report
    echo
    echo "Nothing was changed. To apply:  bash scripts/fix-invoice-totals.sh --apply"
    ;;
  apply)
    report
    echo
    read -r -p "Type APPLY to change the invoices listed above (a backup is kept as batch $batch): " ok
    [ "$ok" = "APPLY" ] || { echo "Not applied."; exit 1; }
    $PSQL -q -v ON_ERROR_STOP=1 -v batch="$batch" -P pager=off <<SQL
begin;
$PLAN
create table if not exists purchase_invoice_total_fix_backup (batch text, invoice_id int, old_total real, new_total real, old_taxable float8, old_cgst float8, old_sgst float8, old_igst float8, old_roundoff float8, done_on timestamptz default now());
create table if not exists purchase_invoice_item_total_fix_backup (batch text, item_id int, old_taxable float8, old_cgst float8, old_sgst float8, old_igst float8);
create temp table fx_go as select invoice_id from fx_inv where changed and skip is null;
insert into purchase_invoice_total_fix_backup (batch, invoice_id, old_total, new_total, old_taxable, old_cgst, old_sgst, old_igst, old_roundoff)
  select :'batch', i.id, i.total, g.new_total, i.taxable_value, i.cgst_amount, i.sgst_amount, i.igst_amount, i.round_off
    from purchase_invoice i join fx_inv g on g.invoice_id = i.id join fx_go using (invoice_id);
insert into purchase_invoice_item_total_fix_backup (batch, item_id, old_taxable, old_cgst, old_sgst, old_igst)
  select :'batch', x.id, x.taxable_value, x.cgst_amount, x.sgst_amount, x.igst_amount from purchase_invoice_item x where x.invoice_id in (select invoice_id from fx_go) and x.active and not x.archive;
update purchase_invoice_item x set taxable_value = f.taxable, cgst_amount = f.cgst, sgst_amount = f.sgst, igst_amount = f.igst
  from fx_item f where f.item_id = x.id and f.invoice_id in (select invoice_id from fx_go);
update purchase_invoice i set total = g.new_total, taxable_value = g.taxable, cgst_amount = g.cgst, sgst_amount = g.sgst, igst_amount = g.igst, round_off = g.new_roundoff, updated_on = now()
  from fx_inv g where g.invoice_id = i.id and g.invoice_id in (select invoice_id from fx_go);
select count(*) as invoices_changed from fx_go;
commit;
SQL
    echo "Done. Backup batch: $batch   (undo with: bash scripts/fix-invoice-totals.sh --undo $batch)"
    echo "Check again with: bash scripts/check-invoice-totals.sh"
    ;;
  undo)
    $PSQL -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
\echo batches on record:
select batch, count(*) as invoices, min(done_on) as done_on from purchase_invoice_total_fix_backup group by batch order by min(done_on) desc;
SQL
    if [ "$batch_given" = 0 ]; then
      batch=$($PSQL -At -c "select batch from purchase_invoice_total_fix_backup group by batch order by min(done_on) desc limit 1" | tr -d '')
      [ -z "$batch" ] && { echo "Nothing to undo."; exit 1; }
      echo "Undoing the latest batch: $batch"
    fi
    $PSQL -v ON_ERROR_STOP=1 -v batch="$batch" -P pager=off <<'SQL'
begin;
with restored as (
  update purchase_invoice i set total = b.old_total, taxable_value = b.old_taxable, cgst_amount = b.old_cgst, sgst_amount = b.old_sgst, igst_amount = b.old_igst,
         round_off = b.old_roundoff, updated_on = now()
    from purchase_invoice_total_fix_backup b
   where b.batch = :'batch' and b.invoice_id = i.id and i.total = b.new_total          -- only an invoice not changed since the correction
  returning i.id
)
update purchase_invoice_item x set taxable_value = ib.old_taxable, cgst_amount = ib.old_cgst, sgst_amount = ib.old_sgst, igst_amount = ib.old_igst
  from purchase_invoice_item_total_fix_backup ib
 where ib.batch = :'batch' and ib.item_id = x.id and x.invoice_id in (select id from restored);
select count(*) as invoices_put_back from purchase_invoice i join purchase_invoice_total_fix_backup b on b.invoice_id = i.id and b.batch = :'batch' and i.total = b.old_total;
commit;
SQL
    ;;
esac
