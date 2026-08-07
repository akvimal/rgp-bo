alter table public.sale
    add column if not exists acting_user_id int4 null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'sale_acting_user_fk'
    ) then
        alter table public.sale
            add constraint sale_acting_user_fk foreign key (acting_user_id) references public.app_user(id);
    end if;
end $$;

create index if not exists idx_sale_acting_user on public.sale(acting_user_id);
