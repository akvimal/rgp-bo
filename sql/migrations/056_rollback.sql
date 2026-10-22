ALTER TABLE public.sale DROP COLUMN IF EXISTS credit_amount;
ALTER TABLE public.sale_return_item DROP COLUMN IF EXISTS refund_amount, DROP COLUMN IF EXISTS refund_mode;
DROP TABLE IF EXISTS public.customer_credit_entry;
