-- Applied by `scripts/prod-upgrade.sh load-vendors <csv>` after the CSV rows have been copied into _v_in
-- (columns as in reports/vendor_sheet.sql). Runs inside a transaction opened by the script.
-- Empty cells keep the stored value. A bad GSTIN or terms value aborts the whole load.
\set ON_ERROR_STOP on

select count(*) as bad_gstin_n, count(*) > 0 as bad_gstin from _v_in i left join vendor v on v.id = i.vendor_id
 where nullif(trim(i.gstn), '') is not null and upper(trim(i.gstn)) is distinct from v.gstn
   and upper(trim(i.gstn)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' \gset
select count(*) as bad_terms_n, count(*) > 0 as bad_terms from _v_in
 where nullif(trim(payment_terms_days), '') is not null and trim(payment_terms_days) !~ '^[0-9]{1,3}$' \gset
select count(*) as unknown_vendor_n, count(*) > 0 as unknown_vendor from _v_in i where not exists (select 1 from vendor v where v.id = i.vendor_id) \gset

\if :bad_gstin
  select i.vendor_id, i.business_name, i.gstn as invalid_gstin from _v_in i left join vendor v on v.id = i.vendor_id
   where nullif(trim(i.gstn), '') is not null and upper(trim(i.gstn)) is distinct from v.gstn and upper(trim(i.gstn)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$';
  \echo LOAD ABORTED: :bad_gstin_n row(s) with an invalid GSTIN
  rollback;
  \quit 1
\endif
\if :bad_terms
  \echo LOAD ABORTED: :bad_terms_n row(s) with payment terms that are not whole days (0-999)
  rollback;
  \quit 1
\endif
\if :unknown_vendor
  \echo LOAD ABORTED: :unknown_vendor_n row(s) with a vendor_id that does not exist
  rollback;
  \quit 1
\endif

with changed as (
  update vendor v set
    gstn = coalesce(nullif(upper(trim(i.gstn)), ''), v.gstn),
    payment_terms_days = coalesce(nullif(trim(i.payment_terms_days), '')::int, v.payment_terms_days),
    contact_phone = coalesce(nullif(trim(i.contact_phone), ''), v.contact_phone),
    updated_on = now()
  from _v_in i
  where i.vendor_id = v.id
    and (   nullif(upper(trim(i.gstn)), '') is distinct from null and upper(trim(i.gstn)) is distinct from v.gstn
         or nullif(trim(i.payment_terms_days), '') is not null and trim(i.payment_terms_days)::int is distinct from v.payment_terms_days
         or nullif(trim(i.contact_phone), '') is not null and trim(i.contact_phone) is distinct from v.contact_phone)
  returning v.id)
select count(*) as updated from changed \gset
\echo LOAD: :updated vendor(s) updated

\if :dry_run
  \echo LOAD: dry run, rolled back
  rollback;
\else
  commit;
\endif
