-- 183 rollback: an expense no longer says where its cash came from. Drawer rows posted for expenses stay as plain till expenses.
DROP INDEX IF EXISTS public.store_cash_accounts_expense_idx;
ALTER TABLE public.store_cash_accounts DROP COLUMN IF EXISTS expense_id;
ALTER TABLE public.expense DROP CONSTRAINT IF EXISTS expense_cash_source_chk;
ALTER TABLE public.expense DROP COLUMN IF EXISTS shift_id;
ALTER TABLE public.expense DROP COLUMN IF EXISTS cash_source;
