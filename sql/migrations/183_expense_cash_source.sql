-- 183: a cash expense in the Expenses ledger says where the cash came from. "DRAWER" takes it out of an open shift's drawer (a drawer row is posted for that shift,
-- so the shift's expected cash and the count agree); "OUTSIDE" is cash that did not come from a till (the owner's pocket, petty cash not tracked here). Expenses
-- paid another way, and older ones, have none. The drawer row points back at its expense, so the expense report counts it once.
-- Safe to run twice.
ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS cash_source varchar(8);
ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS shift_id int4 REFERENCES public.store_shifts(id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_cash_source_chk') THEN
    ALTER TABLE public.expense ADD CONSTRAINT expense_cash_source_chk CHECK (cash_source IS NULL OR cash_source IN ('DRAWER', 'OUTSIDE'));
  END IF;
END $$;
ALTER TABLE public.store_cash_accounts ADD COLUMN IF NOT EXISTS expense_id int4 REFERENCES public.expense(id);
CREATE INDEX IF NOT EXISTS store_cash_accounts_expense_idx ON public.store_cash_accounts (expense_id) WHERE expense_id IS NOT NULL;
