-- rollback of 102_stock_audit_records.sql
DROP TABLE IF EXISTS public.stock_audit_document;
DROP INDEX IF EXISTS public.stock_audit_no_uq;
ALTER TABLE public.stock_audit_plan DROP CONSTRAINT IF EXISTS stock_audit_plan_scope_chk;
DELETE FROM public.stock_audit_plan WHERE scope IN ('FAST', 'SCHEDULE', 'EXPIRY');
ALTER TABLE public.stock_audit_plan ADD CONSTRAINT stock_audit_plan_scope_chk CHECK (scope IN ('ALL', 'CATEGORY', 'ROTATE'));
ALTER TABLE public.stock_audit
  DROP COLUMN IF EXISTS certified_note, DROP COLUMN IF EXISTS certified_by, DROP COLUMN IF EXISTS certified_on,
  DROP COLUMN IF EXISTS scope, DROP COLUMN IF EXISTS audit_no, DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.product_qtychange
  DROP COLUMN IF EXISTS recount_on, DROP COLUMN IF EXISTS recount_by, DROP COLUMN IF EXISTS recount_qty,
  DROP COLUMN IF EXISTS counted_qty, DROP COLUMN IF EXISTS book_qty;
DROP TABLE IF EXISTS public.stock_count_line;
ALTER TABLE public.stock_count DROP COLUMN IF EXISTS finished_at;
