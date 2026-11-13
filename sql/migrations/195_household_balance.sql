-- 195: customer households, step 4 (docs/planning/CUSTOMER_HOUSEHOLDS.md): the balance is the household's. A family pays together, so store credit, what is owed
-- for bills left to pay later, and the pay-later limit belong to the number, not to each person on it.
--
--   customer_credit_entry.household_id, customer_due_entry.household_id   the household the entry belongs to, stamped when the row is written (a trigger, so every
--                                                                         writer is covered); customer_id still says who bought or returned
--   household.credit_limit                                                the pay-later limit for the whole household (customer.credit_limit is no longer read)
--
-- The balance is the sum by household. Backfill: each entry takes its customer's household; the household's limit is the highest limit any of its people had (so
-- nobody loses credit they were given), reported as a NOTICE when people differed; the old per-person limit is made equal to it. Requires 193. Re-runnable.

ALTER TABLE public.customer_credit_entry ADD COLUMN IF NOT EXISTS household_id int4 NULL REFERENCES public.household(id);
ALTER TABLE public.customer_due_entry    ADD COLUMN IF NOT EXISTS household_id int4 NULL REFERENCES public.household(id);
ALTER TABLE public.household             ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------------------------------------------- backfill (before the triggers exist)
UPDATE public.customer_credit_entry e SET household_id = c.household_id FROM public.customer c WHERE c.id = e.customer_id AND e.household_id IS NULL;
UPDATE public.customer_due_entry    e SET household_id = c.household_id FROM public.customer c WHERE c.id = e.customer_id AND e.household_id IS NULL;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT household_id FROM public.customer WHERE household_id IS NOT NULL
     GROUP BY household_id HAVING count(DISTINCT coalesce(credit_limit, 0)) > 1) x;
  RAISE NOTICE 'households whose people had different credit limits (the highest is kept): %', n;
END $$;

UPDATE public.household h SET credit_limit = x.mx
  FROM (SELECT household_id, max(coalesce(credit_limit, 0)) AS mx FROM public.customer WHERE household_id IS NOT NULL GROUP BY household_id) x
 WHERE x.household_id = h.id AND h.credit_limit IS DISTINCT FROM x.mx;

UPDATE public.customer c SET credit_limit = h.credit_limit
  FROM public.household h WHERE h.id = c.household_id AND coalesce(c.credit_limit, 0) IS DISTINCT FROM h.credit_limit;

CREATE INDEX IF NOT EXISTS customer_credit_entry_household_idx ON public.customer_credit_entry (household_id);
CREATE INDEX IF NOT EXISTS customer_due_entry_household_idx    ON public.customer_due_entry (household_id);

-- ---------------------------------------------------------------------------------------------------------------- the stamp
CREATE OR REPLACE FUNCTION public.ledger_stamp_household() RETURNS trigger AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    SELECT household_id INTO NEW.household_id FROM public.customer WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_credit_entry_household_trg ON public.customer_credit_entry;
CREATE TRIGGER customer_credit_entry_household_trg BEFORE INSERT ON public.customer_credit_entry
  FOR EACH ROW EXECUTE FUNCTION public.ledger_stamp_household();
DROP TRIGGER IF EXISTS customer_due_entry_household_trg ON public.customer_due_entry;
CREATE TRIGGER customer_due_entry_household_trg BEFORE INSERT ON public.customer_due_entry
  FOR EACH ROW EXECUTE FUNCTION public.ledger_stamp_household();
