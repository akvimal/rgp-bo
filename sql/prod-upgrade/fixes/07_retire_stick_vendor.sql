-- approval: required
-- 07_retire_stick_vendor.sql
-- The vendor "stick" is a catch-all that old entries were typed under (20 invoices, 2022 to 2026, about 25,000 units of stock on 871 products,
-- including a Rs 5.2 lakh invoice numbered "1"). None of it is a real payable, but the stock it brought in is still on the shelf, so the
-- invoices are kept and only settled, not archived (archiving would also drop them from GST and vendor history):
--   1. each COMPLETE invoice with an amount and no payment gets an opening payment ("settled before cut-over"), as opening_payables.sql does;
--   2. draft (NEW) invoices are archived: they have no stock;
--   3. the vendor is disabled, so it cannot be picked on a new request, order or invoice (reversible: enable it from the vendor list).
-- Matches the vendor by name (case-insensitive, exactly "stick"); add more names to the list below for other catch-all vendors.
-- Needs --approve 07. Safe to run twice; a dry run only counts.
\set ON_ERROR_STOP on

create temp table _retire as select v.id from vendor v where lower(btrim(v.business_name)) in ('stick');

select count(*) as vendors from _retire \gset
select count(*) as settle, coalesce(round(sum(i.total)::numeric, 2), 0) as amount
  from purchase_invoice i
 where i.vendor_id in (select id from _retire) and i.status = 'COMPLETE' and i.active and not i.archive and coalesce(i.total, 0) > 0
   and not exists (select 1 from vendor_payment p where p.invoice_id = i.id) \gset
select count(*) as drafts from purchase_invoice where vendor_id in (select id from _retire) and status = 'NEW' and not archive \gset
\echo FIX 07: vendors matched :vendors, invoices to settle :settle (Rs :amount), drafts to archive :drafts

\if :dry_run
\echo FIX 07: dry run, nothing changed
\else
  insert into vendor_payment (vendor_id, invoice_id, pay_date, amount, pay_mode, trans_ref, remarks, status, communication_status)
  select i.vendor_id, i.id, i.invoice_date, i.total, 'OPENING', 'MIGRATION-OPENING',
         'Settled before system cut-over (opening balance): old entries under a catch-all vendor', 'RECORDED', 'Not Sent'
    from purchase_invoice i
   where i.vendor_id in (select id from _retire) and i.status = 'COMPLETE' and i.active and not i.archive and coalesce(i.total, 0) > 0
     and not exists (select 1 from vendor_payment p where p.invoice_id = i.id);
  update purchase_invoice set archive = true where vendor_id in (select id from _retire) and status = 'NEW' and not archive;
  update vendor set active = false where id in (select id from _retire) and active;
\endif

drop table _retire;
