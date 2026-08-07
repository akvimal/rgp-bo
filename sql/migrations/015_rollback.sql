alter table public.stores
    drop constraint if exists stores_deposit_threshold_chk;

drop index if exists public.idx_stores_business;
