alter table public.stores
    add column if not exists active bool default true not null;

alter table public.stores
    add column if not exists archive bool default false not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'stores_active_archive_chk'
    ) then
        alter table public.stores
            add constraint stores_active_archive_chk check (not (active = false and archive = false));
    end if;
end $$;

update public.stores
set active = true,
    archive = false
where active is null or archive is null;

create index if not exists idx_stores_active on public.stores(active);
create index if not exists idx_stores_archive on public.stores(archive);
