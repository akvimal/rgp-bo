-- 125: Watching how customer details are used, so a person copying them out stands out.
--  * customer_access: one row each time a login looks a customer up (the counter lookup, the list search) or opens one. It feeds the
--    "heavy customer searching" alert and a per-hour limit for logins that may not read every contact detail.
--  * customer_lookup_limit_hour: how many lookups and customer opens one such login may make in an hour (the managers are not limited).
CREATE TABLE IF NOT EXISTS public.customer_access (
  id         bigserial PRIMARY KEY,
  user_id    int4 NOT NULL REFERENCES public.app_user(id),
  kind       text NOT NULL,
  created_on timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_access_kind_chk CHECK (kind IN ('lookup', 'view'))
);
CREATE INDEX IF NOT EXISTS customer_access_user_time_idx ON public.customer_access (user_id, created_on DESC);

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES ('customers', 'customer_lookup_limit_hour', '600', 'How many customer lookups and opens one login that cannot read all contact details may make per hour', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
