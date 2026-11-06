DROP TABLE IF EXISTS public.customer_due_entry;
ALTER TABLE public.sale DROP COLUMN IF EXISTS due_date, DROP COLUMN IF EXISTS due_amount;
ALTER TABLE public.customer DROP COLUMN IF EXISTS credit_limit;
