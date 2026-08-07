ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_business_active ON public.business(active);
CREATE INDEX IF NOT EXISTS idx_business_archive ON public.business(archive);

UPDATE public.business
SET active = true,
    archive = false
WHERE active IS NULL OR archive IS NULL;
