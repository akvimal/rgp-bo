#!/usr/bin/env bash
# Corrects the totals and the GST split of existing purchase invoices (see scripts/check-invoice-totals.sh for what is wrong).
# Invoices entered through the item form or the invoice reading store each line's amount BEFORE tax; the GST used to be taken out of it as if it were inside,
# and the invoice total left GST out. This puts THOSE invoices right the same way the app now works out new ones.
# Older, migrated invoices store line totals WITH the GST in them: their total and GST split are already right, and they are left alone.
#
#   bash scripts/fix-invoice-totals.sh                 DRY RUN (the default): shows what would change and what is left alone; changes nothing
#   bash scripts/fix-invoice-totals.sh --apply         shows the plan, asks you to type APPLY, then changes the invoices (one transaction, with a backup)
#   bash scripts/fix-invoice-totals.sh --undo [batch]  puts back what a run changed (the latest run when no batch is given), for invoices not changed since
#   bash scripts/fix-invoice-totals.sh 12345           the plan for the invoices matching that number only (works with --apply too)
#   bash scripts/fix-invoice-totals.sh --except 2302,3293   leave those invoice ids out (works with --apply too; for example an opening-stock entry)
#
# What it changes, for an invoice whose line totals are BEFORE tax (PRETAX in check-invoice-totals.sh):
#   each line's taxable value and CGST/SGST/IGST   taxable = the line total, GST = taxable x rate (CGST and SGST halves, or IGST between states)
#   the invoice's taxable value, GST and round-off  the sums of its lines
#   the invoice total                               lines + their GST, less a cash discount, rounded to the rupee
#   the opening payment                             an old invoice settled at the cutover has ONE payment of exactly its old total (mode OPENING); it is moved to the new
#                                                   total so the invoice stays settled instead of showing the GST as unpaid
# What it leaves alone (and lists): invoices with a REAL payment (not the opening entry), invoices in a month already closed for GST, invoices with no lines,
# invoices whose line totals include GST or match neither reading, archived or inactive invoices, and invoices that already come out right.
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

mode=plan; batch=""; match=""; batch_given=0; except=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) mode=apply ;;
    --undo) mode=undo; if [ $# -gt 1 ] && [[ "$2" != --* ]]; then batch="$2"; batch_given=1; shift; fi ;;
    --except) except="${2//[^0-9,]/}"; shift ;;
    *) match="${1//\'/}" ;;
  esac
  shift
done
[ -z "$batch" ] && batch="fix-$(date +%Y%m%d-%H%M%S)"
[ -z "$except" ] && except_sql="false" || except_sql="i.id = any(array[$except]::int[])"

# the plan: what every invoice should be, and why one is left alone. Built once, as temporary tables, so the report and the change read the same figures.
PLAN="
create temp table fx_item as
select x.id as item_id, x.invoice_id, i.supply_type, round(x.total::numeric, 2) as taxable, coalesce(x.tax_pcnt, 0)::numeric as pct,
       round(round(x.total::numeric, 2) * coalesce(x.tax_pcnt, 0)::numeric / 100, 2) as tax,
       (x.status not in ('DISPUTED', 'REJECTED')) as live, x.total::numeric as total,
       (x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0))::numeric as calc_goods,
       (x.qty * x.ptr_value * (1 - coalesce(x.disc_pcnt, 0) / 100.0) * (1 + coalesce(x.tax_pcnt, 0) / 100.0))::numeric as calc_gross,
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
       coalesce(sum(f.calc_goods) filter (where f.live), 0) as calc_goods,
       coalesce(sum(f.calc_gross) filter (where f.live), 0) as calc_gross,
       coalesce(sum(f.total * (1 + f.pct / 100)) filter (where f.live), 0) as gross,
       coalesce(i.cash_discount, 0)::numeric as cd,
       (select count(*) from vendor_payment p where p.invoice_id = i.id and p.active and not p.archive and coalesce(p.trans_ref, '') <> 'MIGRATION-OPENING') as real_payments,
       (select count(*) from vendor_payment p where p.invoice_id = i.id and p.active and not p.archive and p.trans_ref = 'MIGRATION-OPENING') as opening_payments,
       exists (select 1 from gst_filing_month m where m.business_id = s.business_id and m.status = 'CLOSED'
                and m.month = coalesce(i.gst_period, to_char(i.invoice_date, 'YYYY-MM'))) as gst_closed,
       ($except_sql) as excluded,
       null::text as basis, null::numeric as new_total, null::numeric as new_roundoff, null::text as skip, false as changed
  from purchase_invoice i join fx_item f on f.invoice_id = i.id left join vendor v on v.id = i.vendor_id left join stores s on s.id = i.store_id
 where i.active and not i.archive $( if [ -n "$match" ]; then echo "and upper(coalesce(i.invoice_no, 'challan ' || i.challan_no)) like upper('%$match%')"; fi )
 group by i.id, v.business_name, s.business_id;
-- what the stored line totals are: before tax (the GST has to be added), with GST in them (already right), or neither
update fx_inv set basis = case when goods = 0 then 'NONE'
                               when abs(goods - calc_goods) <= greatest(1, 0.003 * calc_goods) then 'PRETAX'
                               when abs(goods - calc_gross) <= greatest(1, 0.003 * calc_gross) then 'INCLUSIVE'
                               else 'OTHER' end;
update fx_inv set new_total = round(case when cd > 0 and goods > cd then gross * (goods - cd) / goods else gross end, 0) where basis = 'PRETAX';
update fx_inv set new_roundoff = round(new_total - (taxable + cgst + sgst + igst), 2) where basis = 'PRETAX';
update fx_inv set changed = (abs(new_total - old_total) >= 0.5 or abs(taxable - old_taxable) > 0.01 or abs((cgst + sgst + igst) - old_gst) > 0.01) where basis = 'PRETAX';
update fx_inv set skip = case when excluded then 'excluded by you' when real_payments > 0 then 'has real payments' when gst_closed then 'GST month closed' end where changed;
"

report() {
  $PSQL -q -v ON_ERROR_STOP=1 -P pager=off <<SQL
$PLAN
\echo ================================================================  the plan (nothing is changed by this)
select basis, count(*) as invoices,
       count(*) filter (where changed and skip is null) as will_change,
       count(*) filter (where changed and skip is not null) as left_for_a_decision,
       count(*) filter (where basis = 'PRETAX' and not changed) as already_right
  from fx_inv group by basis order by basis;
\echo   PRETAX = line totals are before tax (this script fixes them); INCLUSIVE = they already include GST (already right, left alone); OTHER = match neither (left for a person to look at)
\echo
\echo ----------------------------------------------------------------  what it does to what you owe, for the invoices it would change
select status, count(*) as invoices, round(sum(old_total), 2) as total_now, round(sum(new_total), 2) as total_after, round(sum(new_total - old_total), 2) as change,
       count(*) filter (where opening_payments > 0) as opening_payment_moved
  from fx_inv where changed and skip is null group by status order by status;
\echo
\echo ----------------------------------------------------------------  the invoices it would change (largest change first)
select invoice_id as id, no, status, left(vendor, 20) as vendor, invoice_date as date, old_total, new_total, round(new_total - old_total, 2) as change,
       old_taxable, round(taxable, 2) as taxable_after, old_gst, round(cgst + sgst + igst, 2) as gst_after, case when opening_payments > 0 then 'yes' else '' end as opening_pay
  from fx_inv where changed and skip is null order by abs(new_total - old_total) desc, invoice_id desc limit 30;
\echo
\echo ----------------------------------------------------------------  left alone because they need a decision (a real payment, a GST month already closed, or you excluded them)
select invoice_id as id, no, status, left(vendor, 20) as vendor, invoice_date as date, skip as reason, old_total, new_total, round(new_total - old_total, 2) as change
  from fx_inv where changed and skip is not null order by abs(new_total - old_total) desc limit 30;
\echo
\echo ----------------------------------------------------------------  line totals that match neither reading (left alone; look at one with: bash scripts/check-invoice-totals.sh NUMBER)
select invoice_id as id, no, status, left(vendor, 20) as vendor, invoice_date as date, round(goods, 2) as stored_lines, round(calc_goods, 2) as qty_x_rate, round(calc_gross, 2) as with_tax, old_total
  from fx_inv where basis = 'OTHER' order by abs(goods - calc_goods) desc limit 15;
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
create table if not exists purchase_payment_total_fix_backup (batch text, payment_id int, invoice_id int, old_amount numeric, new_amount numeric);
create temp table fx_go as select invoice_id from fx_inv where changed and skip is null;
insert into purchase_invoice_total_fix_backup (batch, invoice_id, old_total, new_total, old_taxable, old_cgst, old_sgst, old_igst, old_roundoff)
  select :'batch', i.id, i.total, g.new_total, i.taxable_value, i.cgst_amount, i.sgst_amount, i.igst_amount, i.round_off
    from purchase_invoice i join fx_inv g on g.invoice_id = i.id join fx_go using (invoice_id);
insert into purchase_invoice_item_total_fix_backup (batch, item_id, old_taxable, old_cgst, old_sgst, old_igst)
  select :'batch', x.id, x.taxable_value, x.cgst_amount, x.sgst_amount, x.igst_amount from purchase_invoice_item x where x.invoice_id in (select invoice_id from fx_go) and x.active and not x.archive;
-- the opening payment of a settled old invoice follows its total (only invoices with no real payment are in fx_go)
insert into purchase_payment_total_fix_backup (batch, payment_id, invoice_id, old_amount, new_amount)
  select :'batch', p.id, p.invoice_id, p.amount, g.new_total from vendor_payment p join fx_inv g on g.invoice_id = p.invoice_id join fx_go on fx_go.invoice_id = p.invoice_id
   where p.trans_ref = 'MIGRATION-OPENING' and p.active and not p.archive;
update vendor_payment p set amount = g.new_total from fx_inv g
 where g.invoice_id = p.invoice_id and g.invoice_id in (select invoice_id from fx_go) and p.trans_ref = 'MIGRATION-OPENING' and p.active and not p.archive;
update purchase_invoice_item x set taxable_value = f.taxable, cgst_amount = f.cgst, sgst_amount = f.sgst, igst_amount = f.igst
  from fx_item f where f.item_id = x.id and f.invoice_id in (select invoice_id from fx_go);
update purchase_invoice i set total = g.new_total, taxable_value = g.taxable, cgst_amount = g.cgst, sgst_amount = g.sgst, igst_amount = g.igst, round_off = g.new_roundoff, updated_on = now()
  from fx_inv g where g.invoice_id = i.id and g.invoice_id in (select invoice_id from fx_go);
select count(*) as invoices_changed, (select count(*) from purchase_payment_total_fix_backup where batch = :'batch') as opening_payments_moved from fx_go;
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
      batch=$($PSQL -At -c "select batch from purchase_invoice_total_fix_backup group by batch order by min(done_on) desc limit 1" | tr -d '\r')
      [ -z "$batch" ] && { echo "Nothing to undo."; exit 1; }
      echo "Undoing the latest batch: $batch"
    fi
    $PSQL -q -v ON_ERROR_STOP=1 -v batch="$batch" -P pager=off <<'SQL'
begin;
create temp table fx_back as
  select b.invoice_id from purchase_invoice_total_fix_backup b join purchase_invoice i on i.id = b.invoice_id
   where b.batch = :'batch' and i.total = b.new_total;                       -- only an invoice not changed since the correction
update purchase_invoice i set total = b.old_total, taxable_value = b.old_taxable, cgst_amount = b.old_cgst, sgst_amount = b.old_sgst, igst_amount = b.old_igst,
       round_off = b.old_roundoff, updated_on = now()
  from purchase_invoice_total_fix_backup b where b.batch = :'batch' and b.invoice_id = i.id and i.id in (select invoice_id from fx_back);
update purchase_invoice_item x set taxable_value = ib.old_taxable, cgst_amount = ib.old_cgst, sgst_amount = ib.old_sgst, igst_amount = ib.old_igst
  from purchase_invoice_item_total_fix_backup ib where ib.batch = :'batch' and ib.item_id = x.id and x.invoice_id in (select invoice_id from fx_back);
update vendor_payment p set amount = pb.old_amount
  from purchase_payment_total_fix_backup pb where pb.batch = :'batch' and pb.payment_id = p.id and p.invoice_id in (select invoice_id from fx_back);
select (select count(*) from fx_back) as invoices_put_back;
commit;
SQL
    ;;
esac
