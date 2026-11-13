-- 196: customer households, step 6 (docs/planning/CUSTOMER_HOUSEHOLDS.md): the pay-later limit lives on the household (195); the per-person copy is read by nothing
-- any more, so it goes. The other mirrors stay: customer.mobile and the contact answers are still read by bills, WhatsApp, worklists and imports.
-- Requires 195 (a household's limit is already filled in). Re-runnable. Do not re-run 195 after this (it reads the per-person limit).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer' AND column_name = 'credit_limit')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'household' AND column_name = 'credit_limit') THEN
    RAISE EXCEPTION 'Run 195 first: the household has no credit_limit yet';
  END IF;
END $$;
ALTER TABLE public.customer DROP COLUMN IF EXISTS credit_limit;
