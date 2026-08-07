do $$
begin
    if exists (select 1 from pg_constraint where conname = 'sale_shift_fk') then
        alter table public.sale drop constraint sale_shift_fk;
    end if;
    if exists (select 1 from pg_constraint where conname = 'store_cash_accounts_shift_fk') then
        alter table public.store_cash_accounts drop constraint store_cash_accounts_shift_fk;
    end if;
end$$;

alter table public.sale
    drop column if exists shift_id;

alter table public.store_cash_accounts
    drop column if exists shift_id;

alter table public.store_shifts
    drop column if exists assigned_user_id;

alter table public.store_shift_templates
    drop column if exists assigned_user_id;

drop table if exists public.store_shifts cascade;
drop table if exists public.store_shift_templates cascade;
