DROP TRIGGER IF EXISTS customer_assign_household_trg ON public.customer;
DROP FUNCTION IF EXISTS public.customer_assign_household();
ALTER TABLE public.customer DROP CONSTRAINT IF EXISTS customer_relationship_chk;
DROP INDEX IF EXISTS public.customer_household_idx;
ALTER TABLE public.customer DROP COLUMN IF EXISTS dob, DROP COLUMN IF EXISTS relationship, DROP COLUMN IF EXISTS household_id;
DROP TABLE IF EXISTS public.household_mobile_history;
DROP TABLE IF EXISTS public.household;
