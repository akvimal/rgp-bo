DROP INDEX IF EXISTS public.sale_deliveries_expense_uq;
DROP INDEX IF EXISTS public.sale_deliveries_cash_entry_uq;
ALTER TABLE public.sale_deliveries DROP CONSTRAINT IF EXISTS sale_deliveries_cost_mode_chk;
ALTER TABLE public.sale_deliveries DROP CONSTRAINT IF EXISTS sale_deliveries_cost_via_chk;
ALTER TABLE public.sale_deliveries
  DROP COLUMN IF EXISTS confirmed_by_user, DROP COLUMN IF EXISTS cost_linked, DROP COLUMN IF EXISTS expense_id, DROP COLUMN IF EXISTS cash_entry_id, DROP COLUMN IF EXISTS cost_paid_by,
  DROP COLUMN IF EXISTS cost_paid_on, DROP COLUMN IF EXISTS cost_paid_ref, DROP COLUMN IF EXISTS cost_paid_mode, DROP COLUMN IF EXISTS cost_paid_via;
