-- 204: indexes for the dashboard's heavy reads (sales by store and day, adjustments by store). Additive and re-runnable.
CREATE INDEX IF NOT EXISTS sale_store_billdate_idx ON public.sale (store_id, bill_date) WHERE status = 'COMPLETE' AND active AND NOT archive;
CREATE INDEX IF NOT EXISTS product_qtychange_store_item_idx ON public.product_qtychange (store_id, item_id) WHERE active AND NOT archive;
