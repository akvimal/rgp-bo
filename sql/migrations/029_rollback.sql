-- 029_rollback.sql

alter table public.product_qtychange drop column if exists transfer_id;
drop table if exists public.store_stock_transfer;

alter table public.product_qtychange drop column if exists store_id;
alter table public.sale drop column if exists store_id;

alter table public.purchase_invoice alter column store_id drop not null;
alter table public.purchase_invoice drop column if exists store_id;
