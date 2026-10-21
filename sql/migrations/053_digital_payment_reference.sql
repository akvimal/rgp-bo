-- 053_digital_payment_reference.sql
-- Digital payments can only be reconciled with the provider's settlement file if each bill carries the provider and
-- the provider's reference (the Paytm transaction / UTR number). From now on a completed bill with a digital amount
-- must carry both; this stores the provider and stops one reference being used on two bills.
-- History has no references (none of the old digital bills carry one), so the index starts clean.
ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS digi_provider varchar(20);

CREATE UNIQUE INDEX IF NOT EXISTS sale_digi_ref_uq
  ON public.sale (digi_provider, upper(digi_refno))
  WHERE status = 'COMPLETE' AND digi_provider IS NOT NULL AND coalesce(btrim(digi_refno), '') <> '';
