-- 083: when cash is due at the bank. Besides the amount (stores.deposit_threshold) a store can have a schedule: every day, certain weekdays (0 = Sunday), or certain days of the month (0 = the last day). Whichever comes first makes a deposit due.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS deposit_schedule varchar(10) NOT NULL DEFAULT 'none';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS deposit_weekdays smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS deposit_month_days smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_deposit_schedule_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_deposit_schedule_chk CHECK (deposit_schedule IN ('none', 'daily', 'weekly', 'monthly'));
