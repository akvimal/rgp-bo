-- 188: the bill. The business name can carry a registered or trade-mark sign wherever it is printed as a title (the bill and the WhatsApp copy), and the foot of the
-- bill is a template the business writes: one for the business (the fallback) and one per store. Both empty means the standard foot. Safe to run twice.
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS name_suffix varchar(2) NOT NULL DEFAULT '';
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS bill_footer text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS bill_footer text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_name_suffix_chk') THEN
    ALTER TABLE public.business ADD CONSTRAINT business_name_suffix_chk CHECK (name_suffix IN ('', E'®', E'™'));
  END IF;
END $$;
