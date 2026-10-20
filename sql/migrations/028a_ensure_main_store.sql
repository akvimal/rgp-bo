-- 028a_ensure_main_store.sql
-- Migration 029 backfills every existing purchase and sale to the lowest-id store and makes
-- purchase_invoice.store_id NOT NULL. The stores table is created empty by 014, and only the dev seed
-- fills it, so a database that predates multi-store (production) has no store and 029 fails.
--
-- This creates the single "Main Store" when no store exists, under the first business, and gives every
-- active user access to it (user_stores is also new and empty; without it nobody can open a shift).
-- Rename the store afterwards in Settings -> Store. It is a no-op once a store exists.

do $$
declare
  new_store integer;
begin
  if exists (select 1 from public.stores) then
    return;
  end if;
  if not exists (select 1 from public.business) then
    raise exception 'No business row exists; create the business before running this migration';
  end if;

  insert into public.stores (location, business_id, active, archive)
  values ('Main Store', (select min(id) from public.business), true, false)
  returning id into new_store;

  insert into public.user_stores (user_id, store_id, is_primary)
  select u.id, new_store, true from public.app_user u
  where u.active = true and u.archive = false
  on conflict do nothing;

  raise notice 'Created Main Store (id %) and assigned % active user(s)', new_store, (select count(*) from public.user_stores where store_id = new_store);
end $$;
