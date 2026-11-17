-- Rollback of 218: the "message sent" records cannot stay under the old list of outcomes, so they are removed first.
DELETE FROM public.refill_followup WHERE outcome = 'MESSAGED';
ALTER TABLE public.refill_followup DROP CONSTRAINT IF EXISTS refill_followup_outcome_chk;
ALTER TABLE public.refill_followup ADD CONSTRAINT refill_followup_outcome_chk
  CHECK (outcome IN ('WILL_BUY','NO_ANSWER','CALLBACK','BOUGHT_ELSEWHERE','NOT_NEEDED'));
