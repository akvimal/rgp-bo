-- 194: customer households, step 3 (docs/planning/CUSTOMER_HOUSEHOLDS.md): the contact answers belong to the household, because they belong to the NUMBER.
-- Consent, "do not contact", preferred channel, message language and the review opt-out are one answer for everyone on a mobile; "stop" sent from a shared
-- WhatsApp number cannot mean "stop for the husband but not the wife".
--
-- The household holds the answer; the customer columns stay as mirrors, kept equal by triggers, so every existing reader and writer keeps working untouched:
--   - a change to any person's answer is the household's answer and is copied to everyone on the number;
--   - a new person on an existing number takes the household's answers (consent is per number); the first person of a new number sets them;
--   - a person who moves to another number takes that household's answers.
-- Backfill: the safe answer wins. If anyone on a number asked not to be contacted (or opted out of review invitations) the household has; consent, channel and
-- language come from the most recent answer given. The number of households whose people disagreed is reported as a NOTICE. Requires 193. Re-runnable.

ALTER TABLE public.household
  ADD COLUMN IF NOT EXISTS contact_consent  text NULL,
  ADD COLUMN IF NOT EXISTS consent_on       timestamptz NULL,
  ADD COLUMN IF NOT EXISTS consent_by       int4 NULL,
  ADD COLUMN IF NOT EXISTS do_not_contact   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_channel text NULL,
  ADD COLUMN IF NOT EXISTS message_language varchar(2) NULL,
  ADD COLUMN IF NOT EXISTS review_optout    boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------------------------------------------- backfill (before the triggers exist)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT household_id FROM public.customer WHERE household_id IS NOT NULL
     GROUP BY household_id
    HAVING count(DISTINCT (coalesce(do_not_contact, false), coalesce(contact_consent, ''), coalesce(preferred_channel, ''), coalesce(message_language, ''), coalesce(review_optout, false))) > 1) x;
  RAISE NOTICE 'households whose people disagreed about contact (settled by the safe answer): %', n;
END $$;

WITH agg AS (
  SELECT household_id, bool_or(coalesce(do_not_contact, false)) AS dnc, bool_or(coalesce(review_optout, false)) AS ro
    FROM public.customer WHERE household_id IS NOT NULL GROUP BY household_id),
consent AS (
  SELECT DISTINCT ON (household_id) household_id, contact_consent, consent_on, consent_by FROM public.customer
   WHERE household_id IS NOT NULL AND contact_consent IS NOT NULL
   ORDER BY household_id, consent_on DESC NULLS LAST, id DESC),
chan AS (
  SELECT DISTINCT ON (household_id) household_id, preferred_channel FROM public.customer
   WHERE household_id IS NOT NULL AND preferred_channel IS NOT NULL
   ORDER BY household_id, updated_on DESC NULLS LAST, id DESC),
lang AS (
  SELECT DISTINCT ON (household_id) household_id, message_language FROM public.customer
   WHERE household_id IS NOT NULL AND message_language IS NOT NULL
   ORDER BY household_id, updated_on DESC NULLS LAST, id DESC)
UPDATE public.household h SET
    do_not_contact = agg.dnc, review_optout = agg.ro,
    contact_consent = consent.contact_consent, consent_on = consent.consent_on, consent_by = consent.consent_by,
    preferred_channel = chan.preferred_channel, message_language = lang.message_language
  FROM agg
  LEFT JOIN consent ON consent.household_id = agg.household_id
  LEFT JOIN chan ON chan.household_id = agg.household_id
  LEFT JOIN lang ON lang.household_id = agg.household_id
 WHERE h.id = agg.household_id;

-- everyone on a number now carries the household's answer
UPDATE public.customer c SET
    do_not_contact = h.do_not_contact, review_optout = h.review_optout, contact_consent = h.contact_consent, consent_on = h.consent_on, consent_by = h.consent_by,
    preferred_channel = h.preferred_channel, message_language = h.message_language
  FROM public.household h
 WHERE h.id = c.household_id
   AND (coalesce(c.do_not_contact, false), coalesce(c.review_optout, false), c.contact_consent, c.consent_on, c.consent_by, c.preferred_channel, c.message_language)
       IS DISTINCT FROM (h.do_not_contact, h.review_optout, h.contact_consent, h.consent_on, h.consent_by, h.preferred_channel, h.message_language);

-- ---------------------------------------------------------------------------------------------------------------- the triggers
-- a person's change is the household's answer, copied to the others (the nested updates fire this trigger again at depth 2, which does nothing)
CREATE OR REPLACE FUNCTION public.customer_sync_household_contact() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.household_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.household SET
      contact_consent = NEW.contact_consent, consent_on = NEW.consent_on, consent_by = NEW.consent_by, do_not_contact = coalesce(NEW.do_not_contact, false),
      preferred_channel = NEW.preferred_channel, message_language = NEW.message_language, review_optout = coalesce(NEW.review_optout, false), updated_on = now()
   WHERE id = NEW.household_id;
  UPDATE public.customer SET
      contact_consent = NEW.contact_consent, consent_on = NEW.consent_on, consent_by = NEW.consent_by, do_not_contact = NEW.do_not_contact,
      preferred_channel = NEW.preferred_channel, message_language = NEW.message_language, review_optout = NEW.review_optout
   WHERE household_id = NEW.household_id AND id <> NEW.id
     AND (do_not_contact, review_optout, contact_consent, consent_on, consent_by, preferred_channel, message_language)
         IS DISTINCT FROM (NEW.do_not_contact, NEW.review_optout, NEW.contact_consent, NEW.consent_on, NEW.consent_by, NEW.preferred_channel, NEW.message_language);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_sync_household_contact_trg ON public.customer;
CREATE TRIGGER customer_sync_household_contact_trg AFTER UPDATE ON public.customer
  FOR EACH ROW
  WHEN (OLD.contact_consent IS DISTINCT FROM NEW.contact_consent OR OLD.consent_on IS DISTINCT FROM NEW.consent_on OR OLD.consent_by IS DISTINCT FROM NEW.consent_by
        OR OLD.do_not_contact IS DISTINCT FROM NEW.do_not_contact OR OLD.preferred_channel IS DISTINCT FROM NEW.preferred_channel
        OR OLD.message_language IS DISTINCT FROM NEW.message_language OR OLD.review_optout IS DISTINCT FROM NEW.review_optout)
  EXECUTE FUNCTION public.customer_sync_household_contact();

-- the first person of a household (a new number, or one who moved to a number nobody else has) sets the household's answer
CREATE OR REPLACE FUNCTION public.customer_init_household_contact() RETURNS trigger AS $$
BEGIN
  IF NEW.household_id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer WHERE household_id = NEW.household_id AND id <> NEW.id) THEN
    UPDATE public.household SET
        contact_consent = NEW.contact_consent, consent_on = NEW.consent_on, consent_by = NEW.consent_by, do_not_contact = coalesce(NEW.do_not_contact, false),
        preferred_channel = NEW.preferred_channel, message_language = NEW.message_language, review_optout = coalesce(NEW.review_optout, false), updated_on = now()
     WHERE id = NEW.household_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_init_household_contact_ins_trg ON public.customer;
CREATE TRIGGER customer_init_household_contact_ins_trg AFTER INSERT ON public.customer
  FOR EACH ROW EXECUTE FUNCTION public.customer_init_household_contact();
DROP TRIGGER IF EXISTS customer_init_household_contact_upd_trg ON public.customer;
CREATE TRIGGER customer_init_household_contact_upd_trg AFTER UPDATE ON public.customer
  FOR EACH ROW WHEN (OLD.household_id IS DISTINCT FROM NEW.household_id)
  EXECUTE FUNCTION public.customer_init_household_contact();

-- a person who joins (or moves to) a number that already has people takes the household's answers: consent is per number
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
  -- a number that already has people: their answers are the household's, and the newcomer takes them
  IF EXISTS (SELECT 1 FROM public.customer WHERE household_id = hid AND id <> NEW.id) THEN
    SELECT contact_consent, consent_on, consent_by, do_not_contact, preferred_channel, message_language, review_optout
      INTO NEW.contact_consent, NEW.consent_on, NEW.consent_by, NEW.do_not_contact, NEW.preferred_channel, NEW.message_language, NEW.review_optout
      FROM public.household WHERE id = hid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
