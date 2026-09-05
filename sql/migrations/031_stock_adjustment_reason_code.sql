-- 031_stock_adjustment_reason_code.sql
-- WS-3 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: a fixed reason taxonomy for stock
-- adjustments (DAMAGED/EXPIRED/RETURNED_TO_VENDOR/SHRINKAGE/CORRECTION/OTHER, plus the system
-- values the WS-6 transfer feature already writes into `reason` - TRANSFER_OUT/TRANSFER_IN/
-- TRANSFER_IN_SHORT/TRANSFER_CANCELLED/AUDIT). `reason` stays as-is (free text, unchanged
-- meaning) so existing display code keeps working; `reason_code` is the new machine-filterable
-- category, mirrored onto new rows going forward. No backfill - old rows simply have no code.

alter table public.product_qtychange
  add column if not exists reason_code varchar(20);
