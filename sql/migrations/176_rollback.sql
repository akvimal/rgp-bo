-- rollback of 176
DROP TABLE IF EXISTS public.drug_ref_brand;
DROP TABLE IF EXISTS public.drug_ref_source;
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_dosage_form_chk;
ALTER TABLE public.product DROP COLUMN IF EXISTS dosage_form;
