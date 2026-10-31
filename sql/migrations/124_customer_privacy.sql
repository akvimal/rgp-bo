-- 124: Customer data privacy. Phone numbers, addresses and emails are shown in full only to the roles that need them (the managers, or a role
-- granted customers "reveal"); everyone else sees them masked and can reveal one customer at a time, with a daily limit. Every reveal is kept here
-- so the owner can see who looked at whom (and a bulk copier stands out).
--  * customer_reveal: one row per reveal (who, which customer, when, from where).
--  * customer_reveal_limit: how many different customers one login may reveal in a day (0 = none).
CREATE TABLE IF NOT EXISTS public.customer_reveal (
  id          serial PRIMARY KEY,
  customer_id int4 NOT NULL REFERENCES public.customer(id),
  user_id     int4 NOT NULL REFERENCES public.app_user(id),
  via         text NOT NULL DEFAULT 'screen',
  created_on  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_reveal_user_day_idx ON public.customer_reveal (user_id, created_on DESC);
CREATE INDEX IF NOT EXISTS customer_reveal_customer_idx ON public.customer_reveal (customer_id, created_on DESC);

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES ('customers', 'customer_reveal_limit', '30', 'How many different customers one login may reveal full contact details for, per day', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
