-- 193: customer households, step 1 (docs/planning/CUSTOMER_HOUSEHOLDS.md). A household is the account behind one mobile number; the customer row stays the PERSON
-- (patient or buyer). Nothing about bills, balances or any foreign key moves: this only adds the grouping, so the later steps (who is this for at the till,
-- household balances, one answer for consent) have something to stand on.
--
--   household                 one row per mobile number (a customer with no mobile is a household of one)
--   household_mobile_history  the numbers a household has had, so searching an old number still finds it (used when a number changes)
--   customer.household_id     which household a person belongs to; set by a trigger for every writer (screens, imports, scripts), never left empty
--   customer.relationship     optional: SELF, SPOUSE, CHILD, PARENT, OTHER
--   customer.dob              optional date of birth
--
-- The trigger keeps the grouping true without every writer having to know about it: a new customer joins the household of its mobile (or starts one); a customer
-- whose mobile changes follows it (a person who is alone in a household takes the household's number with them; one of several moves to the household of the
-- new number). Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.household (
  id         serial PRIMARY KEY,
  mobile     varchar NULL,
  notes      varchar(300) NULL,
  created_on timestamptz NOT NULL DEFAULT now(),
  updated_on timestamptz NULL
);
-- one household per number (a household with no number is one person with no mobile)
CREATE UNIQUE INDEX IF NOT EXISTS household_mobile_uq ON public.household (mobile) WHERE mobile IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.household_mobile_history (
  id           serial PRIMARY KEY,
  household_id int4 NOT NULL REFERENCES public.household(id),
  mobile       varchar NOT NULL,
  from_on      timestamptz NOT NULL DEFAULT now(),
  to_on        timestamptz NULL,
  changed_by   int4 NULL
);
CREATE INDEX IF NOT EXISTS household_mobile_history_mobile_idx ON public.household_mobile_history (mobile);
CREATE INDEX IF NOT EXISTS household_mobile_history_household_idx ON public.household_mobile_history (household_id);

ALTER TABLE public.customer
  ADD COLUMN IF NOT EXISTS household_id int4 NULL REFERENCES public.household(id),
  ADD COLUMN IF NOT EXISTS relationship varchar(10) NULL,
  ADD COLUMN IF NOT EXISTS dob date NULL;
CREATE INDEX IF NOT EXISTS customer_household_idx ON public.customer (household_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_relationship_chk') THEN
    ALTER TABLE public.customer ADD CONSTRAINT customer_relationship_chk CHECK (relationship IS NULL OR relationship IN ('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------- the trigger
CREATE OR REPLACE FUNCTION public.customer_assign_household() RETURNS trigger AS $$
DECLARE
  hid int;
  alone boolean := false;
BEGIN
  -- nothing to do when the person already has a household and the number did not change
  IF TG_OP = 'UPDATE' AND NEW.household_id IS NOT NULL AND NEW.mobile IS NOT DISTINCT FROM OLD.mobile THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.household_id IS NOT NULL THEN
    RETURN NEW;                                   -- a writer that chose the household itself (a later step) is trusted
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.household_id IS NOT NULL THEN
    alone := NOT EXISTS (SELECT 1 FROM public.customer WHERE household_id = NEW.household_id AND id <> NEW.id);
  END IF;

  IF NEW.mobile IS NULL THEN
    -- no number: a household of one (a person alone in a household just loses its number)
    IF alone THEN
      UPDATE public.household SET mobile = NULL, updated_on = now() WHERE id = NEW.household_id;
      RETURN NEW;
    END IF;
    INSERT INTO public.household (mobile) VALUES (NULL) RETURNING id INTO hid;
    NEW.household_id := hid;
    RETURN NEW;
  END IF;

  SELECT id INTO hid FROM public.household WHERE mobile = NEW.mobile;
  IF hid IS NULL THEN
    IF alone THEN
      -- the number moves with the person who is alone in the household; the old number is kept in the history
      IF OLD.mobile IS NOT NULL THEN
        INSERT INTO public.household_mobile_history (household_id, mobile, to_on) VALUES (NEW.household_id, OLD.mobile, now());
      END IF;
      UPDATE public.household SET mobile = NEW.mobile, updated_on = now() WHERE id = NEW.household_id;
      RETURN NEW;
    END IF;
    INSERT INTO public.household (mobile) VALUES (NEW.mobile) ON CONFLICT (mobile) WHERE mobile IS NOT NULL DO NOTHING RETURNING id INTO hid;
    IF hid IS NULL THEN SELECT id INTO hid FROM public.household WHERE mobile = NEW.mobile; END IF;   -- another writer got there first
  END IF;
  NEW.household_id := hid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_assign_household_trg ON public.customer;
CREATE TRIGGER customer_assign_household_trg BEFORE INSERT OR UPDATE ON public.customer
  FOR EACH ROW EXECUTE FUNCTION public.customer_assign_household();

-- ---------------------------------------------------------------------------------------------------------------- the backfill
-- one household per number, every customer in the household of its number (archived customers too, so nobody is left without one)
INSERT INTO public.household (mobile)
SELECT DISTINCT c.mobile FROM public.customer c
 WHERE c.mobile IS NOT NULL AND c.household_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.household h WHERE h.mobile = c.mobile);

UPDATE public.customer c SET household_id = h.id
  FROM public.household h WHERE h.mobile = c.mobile AND c.household_id IS NULL;

-- a customer with no number is a household of one (the trigger fires on this update, so the marker is set first and cleared after)
WITH made AS (
  INSERT INTO public.household (mobile, notes)
  SELECT NULL, 'seed:' || c.id FROM public.customer c WHERE c.household_id IS NULL AND c.mobile IS NULL
  RETURNING id, notes)
UPDATE public.customer c SET household_id = made.id FROM made WHERE made.notes = 'seed:' || c.id;
UPDATE public.household SET notes = NULL WHERE notes LIKE 'seed:%';
