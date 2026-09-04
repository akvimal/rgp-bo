-- 026_payables_cleanup.sql
-- WS-1/WS-2 of docs/planning/PURCHASING_PAYABLES_GST_PROGRAM.md:
--   - vendor payment terms, so an invoice's due date isn't "today" by default
--   - payment status + reversal linkage, so a mis-keyed payment can be
--     corrected with an audit trail instead of edited/deleted in place
--   - a batch reference for a future "pay run" (WS-2) that splits one payment
--     across several invoices

alter table public.vendor
    add column if not exists payment_terms_days int4 not null default 0;

alter table public.vendor_payment
    add column if not exists status varchar not null default 'RECORDED',
    add column if not exists reverses_id int4 null,
    add column if not exists batch_ref varchar null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'vendor_payment_reverses_fk'
    ) then
        alter table public.vendor_payment
            add constraint vendor_payment_reverses_fk
            foreign key (reverses_id) references public.vendor_payment(id);
    end if;
end$$;
