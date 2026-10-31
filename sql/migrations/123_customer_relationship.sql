-- 123: Customer relationships (who is active, who is due back, who may be contacted and what was said).
--  * customer.contact_consent: YES / NO, or null when never asked. Promotional messages go only to YES; service messages (a refill reminder)
--    go to anyone who has not said NO. do_not_contact is the stop switch and beats everything.
--  * customer_contact_log: every call or message made to a customer, with what came of it; it keeps the same person from being contacted
--    twice in a week and shows later whether a campaign brought people back.
--  * customer_active_days: a customer with no visit in this many days is "inactive" (derived at read time, never stored).
--  * customer_contact_cap_days: do not contact the same customer again within this many days.
ALTER TABLE public.customer
  ADD COLUMN IF NOT EXISTS contact_consent   text NULL,
  ADD COLUMN IF NOT EXISTS consent_on        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS consent_by        int4 NULL,
  ADD COLUMN IF NOT EXISTS do_not_contact    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_channel text NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_consent_chk') THEN
    ALTER TABLE public.customer ADD CONSTRAINT customer_consent_chk CHECK (contact_consent IS NULL OR contact_consent IN ('YES','NO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_channel_chk') THEN
    ALTER TABLE public.customer ADD CONSTRAINT customer_channel_chk CHECK (preferred_channel IS NULL OR preferred_channel IN ('CALL','WHATSAPP','SMS'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_contact_log (
  id          serial PRIMARY KEY,
  customer_id int4 NOT NULL REFERENCES public.customer(id),
  channel     text NOT NULL,
  audience    text NULL,
  outcome     text NOT NULL,
  note        text NULL,
  created_on  timestamptz NOT NULL DEFAULT now(),
  created_by  int4 NOT NULL REFERENCES public.app_user(id),
  CONSTRAINT customer_contact_channel_chk CHECK (channel IN ('CALL','WHATSAPP','SMS','VISIT','OTHER')),
  CONSTRAINT customer_contact_outcome_chk CHECK (outcome IN ('SENT','REACHED','NO_ANSWER','CALLBACK','NOT_INTERESTED','WRONG_NUMBER','ASKED_TO_STOP'))
);
CREATE INDEX IF NOT EXISTS customer_contact_log_customer_idx ON public.customer_contact_log (customer_id, created_on DESC);

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES
  ('customers', 'customer_active_days', '365', 'A customer with no visit in this many days is shown as inactive', true, false, 1, 1),
  ('customers', 'customer_contact_cap_days', '7', 'Do not contact the same customer again within this many days', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
