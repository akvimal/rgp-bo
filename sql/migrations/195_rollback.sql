DROP TRIGGER IF EXISTS customer_due_entry_household_trg ON public.customer_due_entry;
DROP TRIGGER IF EXISTS customer_credit_entry_household_trg ON public.customer_credit_entry;
DROP FUNCTION IF EXISTS public.ledger_stamp_household();
DROP INDEX IF EXISTS public.customer_due_entry_household_idx;
DROP INDEX IF EXISTS public.customer_credit_entry_household_idx;
ALTER TABLE public.household DROP COLUMN IF EXISTS credit_limit;
ALTER TABLE public.customer_due_entry DROP COLUMN IF EXISTS household_id;
ALTER TABLE public.customer_credit_entry DROP COLUMN IF EXISTS household_id;
-- (the code of step 4 reads these columns: roll the code back with it. customer.credit_limit was kept equal to the household's, so the old code finds a valid limit.)
