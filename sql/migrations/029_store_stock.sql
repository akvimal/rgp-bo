-- 029_store_stock.sql
-- WS-6 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: real per-store stock.
-- Purchases now say which store received the stock; sales record which store sold it;
-- stock adjustments (and the new inter-store transfer) record which store they apply to.
-- Existing data backfills to the lowest-id store (the only store in every environment seen
-- so far), per the locked decision to treat that as "Main Store."

alter table public.purchase_invoice
  add column if not exists store_id integer references public.stores(id);

update public.purchase_invoice
  set store_id = (select min(id) from public.stores)
  where store_id is null;

alter table public.purchase_invoice
  alter column store_id set not null;

alter table public.sale
  add column if not exists store_id integer references public.stores(id);

update public.sale s
  set store_id = ss.store_id
  from public.store_shifts ss
  where s.shift_id = ss.id and s.store_id is null;

-- a sale with no shift (predates shift-required enforcement) has no way to know its store;
-- leaving it null would silently drop it out of every store-scoped "sold" total (null never
-- equals a store id), overstating availability at whichever store is later checked. Same
-- fallback as purchase_invoice: attribute it to the lowest-id store.
update public.sale
  set store_id = (select min(id) from public.stores)
  where store_id is null;

alter table public.product_qtychange
  add column if not exists store_id integer references public.stores(id);

update public.product_qtychange pq
  set store_id = pi.store_id
  from public.purchase_invoice_item pii
  inner join public.purchase_invoice pi on pi.id = pii.invoice_id
  where pq.item_id = pii.id and pq.store_id is null;

create table if not exists public.store_stock_transfer (
    id serial4 not null,
    from_store_id int4 not null references public.stores(id),
    to_store_id int4 not null references public.stores(id),
    purchase_item_id int4 not null references public.purchase_invoice_item(id),
    qty int4 not null,
    received_qty int4 null,
    status varchar(20) not null default 'IN_TRANSIT',
    notes varchar(200) null,
    requested_by int4 null references public.app_user(id),
    received_by int4 null references public.app_user(id),
    dispatched_on timestamptz null default current_timestamp,
    received_on timestamptz null,
    active bool not null default true,
    archive bool not null default false,
    created_on timestamptz not null default current_timestamp,
    created_by int4 not null,
    updated_on timestamptz not null default current_timestamp,
    updated_by int4 null,
    constraint store_stock_transfer_pk primary key (id),
    constraint store_stock_transfer_qty_chk check (qty > 0),
    constraint store_stock_transfer_stores_chk check (from_store_id <> to_store_id)
);

alter table public.product_qtychange
  add column if not exists transfer_id integer references public.store_stock_transfer(id);
