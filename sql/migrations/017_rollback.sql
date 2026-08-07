drop index if exists public.idx_stores_archive;
drop index if exists public.idx_stores_active;

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conname = 'stores_active_archive_chk'
    ) then
        alter table public.stores
            drop constraint stores_active_archive_chk;
    end if;
end $$;

alter table public.stores
    drop column if exists archive;

alter table public.stores
    drop column if exists active;
