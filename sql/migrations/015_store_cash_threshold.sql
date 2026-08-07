alter table public.stores
    add column if not exists deposit_threshold float8 default 0 not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'stores_deposit_threshold_chk'
    ) then
        alter table public.stores
            add constraint stores_deposit_threshold_chk check (deposit_threshold >= 0);
    end if;
end$$;

create index if not exists idx_stores_business on public.stores(business_id);
