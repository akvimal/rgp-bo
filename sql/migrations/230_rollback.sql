-- Rollback of 230: contacts made on the Refills page after the copy are put back into refill_followup (so the old screen still has them), then the new columns go.
-- Outcomes the old log did not have cannot stay in it, so the refill-only ones are removed from the log first.
INSERT INTO public.refill_followup (customer_id, outcome, note, snoozed_until, created_on, created_by)
SELECT l.customer_id, CASE WHEN l.channel = 'WHATSAPP' AND l.outcome = 'SENT' THEN 'MESSAGED' ELSE l.outcome END, l.note,
       COALESCE(l.snoozed_until, l.created_on::date), l.created_on, l.created_by
  FROM public.customer_contact_log l
 WHERE l.source = 'refill' AND l.refill_followup_id IS NULL
   AND l.outcome IN ('WILL_BUY','NO_ANSWER','CALLBACK','BOUGHT_ELSEWHERE','NOT_NEEDED','SENT');
DELETE FROM public.customer_contact_log WHERE source = 'refill';
DELETE FROM public.customer_contact_log WHERE outcome IN ('WILL_BUY','BOUGHT_ELSEWHERE','NOT_NEEDED');
DROP INDEX IF EXISTS public.customer_contact_log_refill_idx;
DROP INDEX IF EXISTS public.customer_contact_log_refill_uq;
ALTER TABLE public.customer_contact_log DROP CONSTRAINT IF EXISTS customer_contact_outcome_chk;
ALTER TABLE public.customer_contact_log ADD CONSTRAINT customer_contact_outcome_chk
  CHECK (outcome IN ('SENT','REACHED','NO_ANSWER','CALLBACK','NOT_INTERESTED','WRONG_NUMBER','ASKED_TO_STOP'));
ALTER TABLE public.customer_contact_log DROP CONSTRAINT IF EXISTS customer_contact_source_chk;
ALTER TABLE public.customer_contact_log DROP COLUMN IF EXISTS refill_followup_id;
ALTER TABLE public.customer_contact_log DROP COLUMN IF EXISTS reason;
ALTER TABLE public.customer_contact_log DROP COLUMN IF EXISTS snoozed_until;
ALTER TABLE public.customer_contact_log DROP COLUMN IF EXISTS due_on;
ALTER TABLE public.customer_contact_log DROP COLUMN IF EXISTS source;
