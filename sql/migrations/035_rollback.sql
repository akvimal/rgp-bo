-- 035_rollback.sql

alter table public.product_qtychange drop column if exists count_id;
drop table if exists public.stock_count;
