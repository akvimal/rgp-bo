-- 230: one contact log. The refill screen kept its own follow-ups (refill_followup) apart from the contact log the worklist and customer screen use
-- (customer_contact_log), so a customer could be called from both and neither knew. From here both write customer_contact_log; the refill screen's history
-- is copied in. refill_followup stays, read-only and unused, for one release (drop it in a later migration once nothing needs it).
--   source         where the contact was made: 'worklist' (the contact list, customer screen) or 'refill' (the Refills page)
--   due_on         for a refill contact: the day the refill was due, so a later bill can be judged against it
--   snoozed_until  for a refill contact: the customer leaves the due list until this day
--   reason         why a customer did not come back, in a few words (used from step 2)
--   refill_followup_id  the row this one was copied from (makes the copy safe to re-run)
-- Rollback: 230_rollback.sql.
ALTER TABLE public.customer_contact_log ADD COLUMN IF NOT EXISTS source varchar(10) NOT NULL DEFAULT 'worklist';
ALTER TABLE public.customer_contact_log ADD COLUMN IF NOT EXISTS due_on date NULL;
ALTER TABLE public.customer_contact_log ADD COLUMN IF NOT EXISTS snoozed_until date NULL;
ALTER TABLE public.customer_contact_log ADD COLUMN IF NOT EXISTS reason text NULL;
ALTER TABLE public.customer_contact_log ADD COLUMN IF NOT EXISTS refill_followup_id int4 NULL;

ALTER TABLE public.customer_contact_log DROP CONSTRAINT IF EXISTS customer_contact_source_chk;
ALTER TABLE public.customer_contact_log ADD CONSTRAINT customer_contact_source_chk CHECK (source IN ('worklist', 'refill'));
ALTER TABLE public.customer_contact_log DROP CONSTRAINT IF EXISTS customer_contact_outcome_chk;
ALTER TABLE public.customer_contact_log ADD CONSTRAINT customer_contact_outcome_chk
  CHECK (outcome IN ('SENT','REACHED','NO_ANSWER','CALLBACK','NOT_INTERESTED','WRONG_NUMBER','ASKED_TO_STOP','WILL_BUY','BOUGHT_ELSEWHERE','NOT_NEEDED'));

CREATE UNIQUE INDEX IF NOT EXISTS customer_contact_log_refill_uq ON public.customer_contact_log (refill_followup_id) WHERE refill_followup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_contact_log_refill_idx ON public.customer_contact_log (created_on DESC) WHERE source = 'refill';

-- the refill screen's history, as it was: a sent reminder is a WhatsApp message sent, the rest are calls
INSERT INTO public.customer_contact_log (customer_id, channel, audience, outcome, note, created_on, created_by, source, snoozed_until, refill_followup_id)
SELECT r.customer_id,
       CASE WHEN r.outcome = 'MESSAGED' THEN 'WHATSAPP' ELSE 'CALL' END,
       'due_back',
       CASE WHEN r.outcome = 'MESSAGED' THEN 'SENT' ELSE r.outcome END,
       r.note, r.created_on, r.created_by, 'refill', r.snoozed_until, r.id
  FROM public.refill_followup r
 WHERE NOT EXISTS (SELECT 1 FROM public.customer_contact_log l WHERE l.refill_followup_id = r.id);
