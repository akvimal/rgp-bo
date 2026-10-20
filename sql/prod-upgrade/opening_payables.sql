-- opening_payables.sql  (one-off, prod upgrade only - NOT a numbered migration)
-- Prod never recorded vendor payments, so after 010 every purchase invoice shows as Unpaid/Overdue.
-- The app derives payment status from vendor_payment rows, so history is settled by writing one
-- opening payment per COMPLETE invoice dated before the cutoff. Invoices on/after the cutoff, and
-- draft (NEW) invoices, are left open and become the real opening payables.
--
--   psql -v ON_ERROR_STOP=1 -v cutoff=2026-08-01 -f opening_payables.sql
--   add  -v dry_run=1  to report only (rolls back)
-- Re-runnable: invoices that already have an opening payment are skipped.

\if :{?dry_run}
\else
\set dry_run 0
\endif

begin;

insert into public.vendor_payment (vendor_id, invoice_id, pay_date, amount, pay_mode, trans_ref, remarks, status, communication_status)
select i.vendor_id, i.id, i.invoice_date, i.total, 'OPENING', 'MIGRATION-OPENING',
       'Settled before system cut-over (opening balance)', 'RECORDED', 'Not Sent'
from public.purchase_invoice i
where i.status = 'COMPLETE' and i.active and not i.archive
  and i.invoice_date < :'cutoff'::date
  and coalesce(i.total, 0) > 0
  and not exists (select 1 from public.vendor_payment p where p.invoice_id = i.id);

select 'settled' as bucket, count(*) invoices, round(sum(amount)::numeric, 2) amount
from public.vendor_payment where trans_ref = 'MIGRATION-OPENING'
union all
select 'still open (complete)', count(*), round(sum(i.total)::numeric, 2)
from public.purchase_invoice i
where i.status = 'COMPLETE' and not exists (select 1 from public.vendor_payment p where p.invoice_id = i.id)
union all
select 'drafts (NEW)', count(*), round(sum(total)::numeric, 2) from public.purchase_invoice where status <> 'COMPLETE';

\if :dry_run
rollback;
\else
commit;
\endif
