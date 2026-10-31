-- 130: A business can use its own logo in the page header (a small PNG, JPEG or WebP kept as a data URL).
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS logo text;
