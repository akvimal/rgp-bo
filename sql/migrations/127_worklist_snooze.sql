-- 127: Postponing a customer on the "Contact today" list for a day, with the reason.
--  * worklist_snooze: one row per postponement (who, why, until which day). A customer with a postponement that has not ended is left off
--    the list until that day, then returns by itself. The rows stay as a history, so someone postponed again and again shows up.
--  Postponing is not contacting: it does not start the contact gap, and it does not touch audiences or campaigns.
CREATE TABLE IF NOT EXISTS public.worklist_snooze (
  id            serial PRIMARY KEY,
  customer_id   int4 NOT NULL REFERENCES public.customer(id),
  snoozed_until date NOT NULL,
  reason        text NOT NULL,
  note          text NULL,
  created_on    timestamptz NOT NULL DEFAULT now(),
  created_by    int4 NOT NULL REFERENCES public.app_user(id),
  CONSTRAINT worklist_snooze_reason_chk CHECK (reason IN ('CALL_LATER', 'AWAY', 'UNWELL', 'BUSY', 'WAITING_STOCK', 'OTHER'))
);
CREATE INDEX IF NOT EXISTS worklist_snooze_customer_idx ON public.worklist_snooze (customer_id, snoozed_until DESC);
