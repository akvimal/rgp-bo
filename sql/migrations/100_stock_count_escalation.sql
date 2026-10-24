-- 100_stock_count_escalation.sql
-- A stock count that finds a product out by more than the escalation value (setting stock_count_escalation_value, default 500 rupees at cost,
-- counted per product across its batches) is marked here, and only a Business Head or Owner-operator may approve or reject its lines.
ALTER TABLE public.product_qtychange ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false;
