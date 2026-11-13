ALTER TABLE public.sale DROP COLUMN IF EXISTS commitment_amount, DROP COLUMN IF EXISTS commitment_id;
DROP TABLE IF EXISTS public.customer_commitment_payment;
DROP TABLE IF EXISTS public.customer_commitment_line;
DROP TABLE IF EXISTS public.customer_commitment;
