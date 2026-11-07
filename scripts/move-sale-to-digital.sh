#!/usr/bin/env bash
# Move the cash part of some completed bills to a digital payment (the customer paid by UPI / card, but the bill was rung as cash).
#
#   move-sale-to-digital.sh show  [--date D] [--store N]                 the day's bills that carry cash (no changes)
#   move-sale-to-digital.sh plan  --bills 12234,12240 [options]          what would change (the DEFAULT when --bills is given; no changes)
#   move-sale-to-digital.sh apply --bills 12234,12240 [options]          back up, show the plan, ask, then change (one transaction)
#   move-sale-to-digital.sh undo  [--batch ID]                           put back what a run changed (the latest run without --batch)
#
# Options:
#   --bills LIST     bill numbers (as printed on the bill), comma separated
#   --date D         the day the bills were rung, YYYY-MM-DD (default: today in India time)
#   --store N        only this store (needed if two stores rang the same bill number that day)
#   --method M       UPI (default), Card, Wallet or Other
#   --ref TEXT       the last 4+ digits of the transaction id (one bill only; a reference can be used on one bill only)
#   --provider P     default Paytm
#   --allow-closed   also change bills of a shift that is already closed (its expected cash and variance are worked out again)
#   --yes            skip the typed confirmation       --no-backup   skip the pg_dump
#
# For each bill the WHOLE cash amount moves to the digital amount (the total, staff credit and pay-later parts are not touched), the bill's
# line in the shift's cash book is removed, and the shift's expected cash and variance are worked out again from its cash book. A bill is left alone
# (and the reason printed) if it is not completed, carries no cash, has no single matching cash-book line, or its shift is closed and --allow-closed was not given.
# The moved bills show as "To verify" on the Digital payments page. Every bill is written to the audit log, and what it was before is kept
# in the table sale_tender_fix so `undo` can put it back. Nothing else (stock, GST, customer dues) is touched.
#
# Where Postgres lives is set by environment, as in clear-day.sh:
#   PG_PREFIX   e.g. "docker exec -i rgp-db"   (default empty = psql on PATH)     PGUSER (default rgpapp)   PGDATABASE (default rgpdb)
set -euo pipefail
export MSYS_NO_PATHCONV=1

PG_PREFIX="${PG_PREFIX:-}"
PGUSER="${PGUSER:-rgpapp}"
PGDATABASE="${PGDATABASE:-rgpdb}"
export PGUSER

mode="${1:-}"; shift || true
day="$(TZ=Asia/Kolkata date +%F)"; store=0; bills=""; method="UPI"; ref=""; provider="Paytm"; closed=0; yes=0; backup=1; batch=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bills) bills="${2//[^0-9,]/}"; shift 2;;
    --date) day="$2"; shift 2;;
    --store) store="$2"; shift 2;;
    --method) method="$2"; shift 2;;
    --ref) ref="$(echo "$2" | tr 'a-z' 'A-Z' | tr -d ' ')"; shift 2;;
    --provider) provider="$2"; shift 2;;
    --batch) batch="$2"; shift 2;;
    --allow-closed) closed=1; shift;;
    --yes) yes=1; shift;;
    --no-backup) backup=0; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
case "$mode" in show|plan|apply|undo) ;; *) echo "usage: $0 show|plan|apply|undo ...  (see the top of this file)" >&2; exit 2;; esac
[[ "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--date must be YYYY-MM-DD" >&2; exit 2; }
[[ "$store" =~ ^[0-9]+$ ]] || { echo "--store must be a number" >&2; exit 2; }
[[ "$provider" =~ ^[A-Za-z0-9]{1,20}$ ]] || { echo "--provider must be letters and digits" >&2; exit 2; }
case "$method" in UPI|Card|Wallet|Other) ;; *) echo "--method must be UPI, Card, Wallet or Other" >&2; exit 2;; esac
[ -z "$ref" ] || [[ "$ref" =~ ^[A-Z0-9][A-Z0-9_/-]{3,39}$ ]] || { echo "--ref must be 4 to 40 letters/digits" >&2; exit 2; }
[ -z "$batch" ] || [[ "$batch" =~ ^[0-9]{14}$ ]] || { echo "--batch is the 14-digit id a run printed" >&2; exit 2; }

psqlq() { $PG_PREFIX psql -q -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"; }

LOG_DDL="create table if not exists public.sale_tender_fix (
  id serial primary key, batch varchar(14) not null, sale_id int4 not null, bill_no int4, done_on timestamptz not null default now(),
  old_cash float8, old_digi float8, old_method varchar, old_ref varchar, old_provider varchar,
  shift_id int4, store_id int4, ledger_date date, ledger_desc varchar, ledger_deposit float8, undone_on timestamptz);"

store_filter=""; [ "$store" != 0 ] && store_filter="and s.store_id = $store"

if [ "$mode" = "show" ]; then
  echo "select s.bill_no, to_char(s.bill_date, 'HH24:MI') as at, s.store_id as store, s.shift_id as shift, sh.status as shift_status, s.total::numeric(12,2), s.cash_amount::numeric(12,2) as cash, s.digi_amount::numeric(12,2) as digital
          from sale s left join store_shifts sh on sh.id = s.shift_id
         where s.bill_date::date = '$day' and s.status = 'COMPLETE' and s.active and s.cash_amount > 0 $store_filter order by s.bill_no;" | psqlq
  exit 0
fi

if [ "$mode" = "undo" ]; then
  [ -n "$batch" ] || batch="$(echo "$LOG_DDL select batch from public.sale_tender_fix where undone_on is null order by id desc limit 1;" | psqlq -At | tail -1)"
  [ -n "$batch" ] || { echo "Nothing to undo."; exit 0; }
  echo "Batch $batch:"
  echo "select sale_id, bill_no, old_cash, old_digi, old_method from public.sale_tender_fix where batch = '$batch' and undone_on is null order by id;" | psqlq
  if [ "$yes" != 1 ]; then read -r -p "Type UNDO to put these bills back: " t; [ "$t" = "UNDO" ] || { echo "Not confirmed. Nothing changed."; exit 1; }; fi
  echo "
begin;
-- only a bill that still looks as this run left it (no cash, digital as moved) is put back
create temp table back on commit drop as
  select f.* from public.sale_tender_fix f join public.sale s on s.id = f.sale_id
   where f.batch = '$batch' and f.undone_on is null and s.cash_amount = 0 and s.digi_amount = f.old_digi + f.old_cash;
update public.sale s set cash_amount = b.old_cash, digi_amount = b.old_digi, digi_method = b.old_method, digi_refno = b.old_ref, digi_provider = b.old_provider, updated_on = now()
  from back b where s.id = b.sale_id;
insert into public.store_cash_accounts (trans_date, category, description, deposit, withdraw, store_id, shift_id)
  select ledger_date, 'SALE', ledger_desc, ledger_deposit, 0, store_id, shift_id from back;
update public.store_shifts sh set
  expected_cash = sh.opening_cash + coalesce((select sum(a.deposit - a.withdraw) from public.store_cash_accounts a where a.shift_id = sh.id), 0),
  variance = case when sh.counted_cash is null then null else sh.counted_cash - (sh.opening_cash + coalesce((select sum(a.deposit - a.withdraw) from public.store_cash_accounts a where a.shift_id = sh.id), 0)) end,
  updated_on = now()
 where sh.id in (select shift_id from back);
insert into public.audit_event (action, entity_type, entity_id, summary, details)
  select 'sale.tender_fix_undone', 'sales', sale_id::text, 'Bill ' || coalesce(bill_no::text, sale_id::text) || ': the digital payment put back to cash (script)', jsonb_build_object('batch', batch) from back;
update public.sale_tender_fix f set undone_on = now() from back b where f.id = b.id;
select count(*) as put_back from back;
commit;
" | psqlq
  echo "Done."
  exit 0
fi

# ---- plan / apply
[ -n "$bills" ] || { echo "--bills is required (find the numbers with: $0 show)" >&2; exit 2; }
bills="$(echo "$bills" | sed 's/^,*//; s/,*$//; s/,,*/,/g')"
count="$(echo "$bills" | tr ',' '\n' | wc -l | tr -d ' ')"
[ -z "$ref" ] || [ "$count" = 1 ] || { echo "--ref can be given for one bill only." >&2; exit 2; }
ref_sql="null"; [ -n "$ref" ] && ref_sql="'$ref'"

PICK="create temp table pick on commit drop as
select s.id, s.bill_no, s.store_id, s.shift_id, s.cash_amount, s.digi_amount, s.digi_method, s.digi_refno, s.digi_provider, sh.status as shift_status,
       (select count(*) from public.store_cash_accounts l where l.shift_id = s.shift_id and l.category = 'SALE'
           and l.description = 'Sale ' || coalesce(s.bill_no::text, s.id::text) and abs(l.deposit - s.cash_amount) < 0.005) as ledger_rows,
       (select min(l.id) from public.store_cash_accounts l where l.shift_id = s.shift_id and l.category = 'SALE'
           and l.description = 'Sale ' || coalesce(s.bill_no::text, s.id::text) and abs(l.deposit - s.cash_amount) < 0.005) as ledger_id,
       case when s.status <> 'COMPLETE' or not s.active then 'not a completed bill'
            when coalesce(s.cash_amount, 0) <= 0 then 'no cash on this bill'
            when s.shift_id is null then 'not in a shift'
            when sh.status <> 'OPEN' and $closed = 0 then 'its shift is closed (use --allow-closed)'
            when (select count(*) from public.store_cash_accounts l where l.shift_id = s.shift_id and l.category = 'SALE'
                   and l.description = 'Sale ' || coalesce(s.bill_no::text, s.id::text) and abs(l.deposit - s.cash_amount) < 0.005) <> 1 then 'no single matching cash-book line'
            else null end as skip
  from public.sale s left join public.store_shifts sh on sh.id = s.shift_id
 where s.bill_no in ($bills) and s.bill_date::date = '$day' $store_filter;"

SHOW_PLAN="select p.bill_no, p.store_id as store, p.shift_id as shift, p.shift_status, p.cash_amount::numeric(12,2) as cash_now, p.digi_amount::numeric(12,2) as digi_now,
       case when p.skip is null then 'MOVE ' || p.cash_amount::numeric(12,2) || ' to $method' else 'LEFT ALONE: ' || p.skip end as action from pick p order by p.bill_no;
select 'bills asked for' as what, $count as n union all select 'found', count(*) from pick union all select 'will move', count(*) from pick where skip is null;
select 'shift ' || p.shift_id || ' (' || p.shift_status || ')' as shift, sh.expected_cash::numeric(12,2) as expected_now,
       (sh.expected_cash - sum(p.cash_amount))::numeric(12,2) as expected_after, sh.counted_cash::numeric(12,2) as counted,
       sh.variance::numeric(12,2) as variance_now, case when sh.counted_cash is null then null else (sh.counted_cash - (sh.expected_cash - sum(p.cash_amount)))::numeric(12,2) end as variance_after
  from pick p join public.store_shifts sh on sh.id = p.shift_id where p.skip is null group by p.shift_id, p.shift_status, sh.expected_cash, sh.counted_cash, sh.variance order by 1;"

if [ "$mode" = "plan" ]; then
  echo "begin; $PICK $SHOW_PLAN rollback;" | psqlq
  echo "Nothing was changed. To apply: $0 apply --bills $bills --date $day --method $method${ref:+ --ref $ref}"
  exit 0
fi

# ---- apply
echo "begin; $PICK $SHOW_PLAN rollback;" | psqlq
if [ "$backup" = 1 ]; then
  out="${HOME:-.}/before_tender_fix_$(date +%Y%m%d%H%M%S).sql.gz"
  echo "Backing up to $out ..."
  $PG_PREFIX pg_dump -U "$PGUSER" "$PGDATABASE" | gzip > "$out"
fi
if [ "$yes" != 1 ]; then read -r -p "Type APPLY to move the bills marked MOVE: " t; [ "$t" = "APPLY" ] || { echo "Not confirmed. Nothing changed."; exit 1; }; fi

batch="$(date +%Y%m%d%H%M%S)"
echo "
begin;
$LOG_DDL
$PICK
insert into public.sale_tender_fix (batch, sale_id, bill_no, old_cash, old_digi, old_method, old_ref, old_provider, shift_id, store_id, ledger_date, ledger_desc, ledger_deposit)
  select '$batch', p.id, p.bill_no, p.cash_amount, p.digi_amount, p.digi_method, p.digi_refno, p.digi_provider, p.shift_id, p.store_id, l.trans_date, l.description, l.deposit
    from pick p join public.store_cash_accounts l on l.id = p.ledger_id where p.skip is null;
update public.sale s set digi_amount = coalesce(s.digi_amount, 0) + p.cash_amount, cash_amount = 0, digi_method = '$method', digi_provider = '$provider', digi_refno = $ref_sql, updated_on = now()
  from pick p where s.id = p.id and p.skip is null;
delete from public.store_cash_accounts l using pick p where p.skip is null and l.id = p.ledger_id;
update public.store_shifts sh set
  expected_cash = sh.opening_cash + coalesce((select sum(a.deposit - a.withdraw) from public.store_cash_accounts a where a.shift_id = sh.id), 0),
  variance = case when sh.counted_cash is null then null else sh.counted_cash - (sh.opening_cash + coalesce((select sum(a.deposit - a.withdraw) from public.store_cash_accounts a where a.shift_id = sh.id), 0)) end,
  updated_on = now()
 where sh.id in (select shift_id from pick where skip is null);
insert into public.audit_event (action, entity_type, entity_id, summary, details)
  select 'sale.tender_fixed', 'sales', p.id::text, 'Bill ' || coalesce(p.bill_no::text, p.id::text) || ': cash ' || p.cash_amount::numeric(12,2) || ' moved to $method (script)',
         jsonb_build_object('batch', '$batch', 'cash', p.cash_amount, 'method', '$method') from pick p where p.skip is null;
select bill_no, cash_amount::numeric(12,2) as moved from pick where skip is null order by bill_no;
commit;
select s.bill_no, s.cash_amount::numeric(12,2) as cash, s.digi_amount::numeric(12,2) as digital, s.digi_method, s.digi_refno from public.sale s
 where s.id in (select sale_id from public.sale_tender_fix where batch = '$batch') order by s.bill_no;
" | psqlq
echo "Done. Batch $batch. To put it back: $0 undo --batch $batch"
