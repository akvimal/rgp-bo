-- 035_stock_count.sql
-- WS-5 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: cycle count / physical stock take.
-- A count is a lightweight header grouping a batch of count lines; the lines themselves reuse
-- the existing product_qtychange audit ledger (PENDING, same manager approve/reject flow already
-- built for WS-3) rather than a parallel stock_count_item table - one fewer table, and count-driven
-- adjustments show up in the same Adjustments screen as everything else.

create table if not exists public.stock_count (
    id serial4 not null,
    status varchar(20) not null default 'IN_PROGRESS',
    category varchar(60) null,
    store_id int4 null references public.stores(id),
    started_by int4 not null references public.app_user(id),
    started_on timestamptz not null default current_timestamp,
    completed_by int4 null references public.app_user(id),
    completed_on timestamptz null,
    constraint stock_count_pk primary key (id)
);

alter table public.product_qtychange
  add column if not exists count_id integer references public.stock_count(id);
