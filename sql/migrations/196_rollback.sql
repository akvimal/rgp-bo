-- puts the per-person limit back, equal to the household's
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2) NOT NULL DEFAULT 0;
UPDATE public.customer c SET credit_limit = h.credit_limit FROM public.household h WHERE h.id = c.household_id;
