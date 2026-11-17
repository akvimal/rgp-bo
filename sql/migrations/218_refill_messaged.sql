-- 218: the refill follow-up gets an outcome for "message sent" (WhatsApp from the Refills page), so a sent reminder is on record and the customer
-- leaves the due list for a few days instead of coming up again tomorrow.
-- Rollback: 218_rollback.sql.
ALTER TABLE public.refill_followup DROP CONSTRAINT IF EXISTS refill_followup_outcome_chk;
ALTER TABLE public.refill_followup ADD CONSTRAINT refill_followup_outcome_chk
  CHECK (outcome IN ('WILL_BUY','NO_ANSWER','CALLBACK','BOUGHT_ELSEWHERE','NOT_NEEDED','MESSAGED'));
