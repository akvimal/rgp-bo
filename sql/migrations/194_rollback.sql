DROP TRIGGER IF EXISTS customer_init_household_contact_upd_trg ON public.customer;
DROP TRIGGER IF EXISTS customer_init_household_contact_ins_trg ON public.customer;
DROP TRIGGER IF EXISTS customer_sync_household_contact_trg ON public.customer;
DROP FUNCTION IF EXISTS public.customer_init_household_contact();
DROP FUNCTION IF EXISTS public.customer_sync_household_contact();
ALTER TABLE public.household
  DROP COLUMN IF EXISTS review_optout, DROP COLUMN IF EXISTS message_language, DROP COLUMN IF EXISTS preferred_channel, DROP COLUMN IF EXISTS do_not_contact,
  DROP COLUMN IF EXISTS consent_by, DROP COLUMN IF EXISTS consent_on, DROP COLUMN IF EXISTS contact_consent;

-- the assign function goes back to its migration-193 form (it no longer reads the household's contact columns)
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
