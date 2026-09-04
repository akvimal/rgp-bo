-- 024_shift_denominations.sql
-- Capture the drawer count by denomination for both opening and closing a shift,
-- and record which operator (POS "Staff" pick) closed it. See
-- docs/planning/CASHIER_SHIFT_CLOSE.md.

alter table public.store_shifts
    add column if not exists opening_denominations jsonb,
    add column if not exists counted_denominations jsonb,
    add column if not exists closed_operator_id int4;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'store_shifts_closed_operator_fk'
    ) then
        alter table public.store_shifts
            add constraint store_shifts_closed_operator_fk
            foreign key (closed_operator_id) references public.app_user(id);
    end if;
end$$;
