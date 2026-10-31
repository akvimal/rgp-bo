-- rollback of 130: the businesses go back to the default logo
ALTER TABLE public.business DROP COLUMN IF EXISTS logo;
