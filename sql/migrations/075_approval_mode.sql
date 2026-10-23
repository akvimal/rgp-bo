-- 075: approval mode (OPERATING_MODES step 2).
--   separate = a maker-checker rule stays as it is today (another person approves)
--   self     = the maker may approve their own adjustment, purchase order or expense
-- Set once per business; a store may override it (NULL follows the business).
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS approval_mode varchar(10) NOT NULL DEFAULT 'separate';
ALTER TABLE public.business DROP CONSTRAINT IF EXISTS business_approval_mode_chk;
ALTER TABLE public.business ADD CONSTRAINT business_approval_mode_chk CHECK (approval_mode IN ('self', 'separate'));
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS approval_mode varchar(10);
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_approval_mode_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_approval_mode_chk CHECK (approval_mode IS NULL OR approval_mode IN ('self', 'separate'));
