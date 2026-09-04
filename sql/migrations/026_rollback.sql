-- 026_rollback.sql

alter table public.vendor_payment
    drop constraint if exists vendor_payment_reverses_fk;

alter table public.vendor_payment
    drop column if exists status,
    drop column if exists reverses_id,
    drop column if exists batch_ref;

alter table public.vendor
    drop column if exists payment_terms_days;
