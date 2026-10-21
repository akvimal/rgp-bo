-- 042_refill_followup.sql
-- Refill follow-up for chronic customers: who was contacted, what came of it, and when to look again.
-- The due list itself is computed from purchase history; this table only records the follow-ups.

CREATE TABLE IF NOT EXISTS public.refill_followup (
  id            serial PRIMARY KEY,
  customer_id   int4 NOT NULL REFERENCES public.customer(id),
  outcome       text NOT NULL,
  note          text NULL,
  snoozed_until date NOT NULL,
  created_on    timestamptz NOT NULL DEFAULT now(),
  created_by    int4 NOT NULL REFERENCES public.app_user(id),
  CONSTRAINT refill_followup_outcome_chk CHECK (outcome IN ('WILL_BUY','NO_ANSWER','CALLBACK','BOUGHT_ELSEWHERE','NOT_NEEDED'))
);
CREATE INDEX IF NOT EXISTS refill_followup_customer_idx ON public.refill_followup (customer_id, created_on DESC);

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"refills","path":"/secure/quality/refills","policies":[{"action":"view"},{"action":"manage"}]}]'::jsonb
)::json
WHERE name IN ('Business Head', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "refills")');
