ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_deposit_schedule_chk;
ALTER TABLE public.stores DROP COLUMN IF EXISTS deposit_month_days;
ALTER TABLE public.stores DROP COLUMN IF EXISTS deposit_weekdays;
ALTER TABLE public.stores DROP COLUMN IF EXISTS deposit_schedule;
