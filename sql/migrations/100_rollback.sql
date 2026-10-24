-- rollback of 100_stock_count_escalation.sql
ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS escalated;
