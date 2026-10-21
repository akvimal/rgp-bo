-- 02_sales_without_customer_to_nil.sql
-- Completed bills saved without a customer (4 in the prod copy) are attached to the NIL walk-in customer
-- (mobile 0000000000), the same record the billing screen uses when no mobile number is given.
-- Safe: only fills a NULL, totals and counts are untouched. Re-running finds nothing.
\set ON_ERROR_STOP on

select coalesce((select id from customer where mobile = '0000000000' order by id limit 1), 0) as nil_id,
       exists (select 1 from customer where mobile = '0000000000') as has_nil \gset
select count(*) as n from sale where status = 'COMPLETE' and customer_id is null \gset
\echo FIX 02: completed bills without a customer: :n (NIL customer id :nil_id)

\if :dry_run
\echo FIX 02: dry run, nothing changed
\else
  \if :has_nil
    update sale set customer_id = :nil_id where status = 'COMPLETE' and customer_id is null;
  \else
    \echo FIX 02: no NIL customer exists, skipped
  \endif
\endif
