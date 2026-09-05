-- 031_rollback.sql

alter table public.product_qtychange drop column if exists reason_code;
