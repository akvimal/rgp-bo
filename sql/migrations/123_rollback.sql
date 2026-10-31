DELETE FROM public.app_setting WHERE setting_key IN ('customer_active_days', 'customer_contact_cap_days') AND category = 'customers';
DROP TABLE IF EXISTS public.customer_contact_log;
ALTER TABLE public.customer
  DROP CONSTRAINT IF EXISTS customer_consent_chk, DROP CONSTRAINT IF EXISTS customer_channel_chk,
  DROP COLUMN IF EXISTS contact_consent, DROP COLUMN IF EXISTS consent_on, DROP COLUMN IF EXISTS consent_by,
  DROP COLUMN IF EXISTS do_not_contact, DROP COLUMN IF EXISTS preferred_channel;
