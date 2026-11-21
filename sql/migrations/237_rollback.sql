-- Rollback of 237: the doses and days on the options go.
ALTER TABLE public.guide_option DROP COLUMN IF EXISTS days;
ALTER TABLE public.guide_option DROP COLUMN IF EXISTS dose;
