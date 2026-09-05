-- 030_product_bin_location.sql
-- WS-1 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: a shelf/rack/bin label per product,
-- so staff can find it in the pharmacy. Business-wide (stock is pooled, not per-store - see
-- WS6_PER_STORE_STOCK.md), so this is a plain column, not a per-store table.

alter table public.product
  add column if not exists bin_location varchar(40);
