-- 184 rollback: an expense no longer names its bank account or payment reference.
DROP INDEX IF EXISTS public.expense_reference_idx;
DROP INDEX IF EXISTS public.expense_bank_account_idx;
ALTER TABLE public.expense DROP COLUMN IF EXISTS reference;
ALTER TABLE public.expense DROP COLUMN IF EXISTS bank_account_id;
