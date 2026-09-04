-- 024_rollback.sql

alter table public.store_shifts
    drop constraint if exists store_shifts_closed_operator_fk;

alter table public.store_shifts
    drop column if exists opening_denominations,
    drop column if exists counted_denominations,
    drop column if exists closed_operator_id;
