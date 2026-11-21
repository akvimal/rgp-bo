-- 236: the Counter guide (docs/planning/COUNTER_GUIDE.md, phases 1 and 2): common medicines for everyday problems, from stock.
-- A card is one problem (a headache with vomiting, a burn): its warning signs, how long is too long, what to say when a doctor is advised, and its options
-- (a composition and form, for whom, and what it must not be given with). A card is DRAFT until a pharmacist approves it, and only APPROVED cards reach
-- the counter. Editing an approved card makes a new draft version, which needs approving again. Prescription-only products are never offered: that is read
-- from the product at the moment of matching, not stored here.
CREATE TABLE IF NOT EXISTS public.guide_card (
  id                 serial PRIMARY KEY,
  key                varchar(40) NOT NULL,
  name               varchar(120) NOT NULL,
  name_ta            varchar(160),
  icon               varchar(16),                    -- an emoji shown on the tile at the counter
  asks_duration      boolean NOT NULL DEFAULT true,
  duration_limit_days int4 NOT NULL DEFAULT 3,       -- this long or longer (see the rules for the buckets) means see a doctor
  referral_text      text NOT NULL,                  -- what to say when a doctor is advised
  referral_text_ta   text,
  status             varchar(10) NOT NULL DEFAULT 'DRAFT',   -- DRAFT | APPROVED | RETIRED
  version            int4 NOT NULL DEFAULT 1,
  approved_by        int4,
  approved_name      varchar(120),                   -- the pharmacist's name, kept as signed
  approved_on        timestamp,
  sort_order         int4 NOT NULL DEFAULT 100,
  created_by         int4,
  created_on         timestamp NOT NULL DEFAULT now(),
  updated_by         int4,
  updated_on         timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guide_card_key_uq ON public.guide_card (lower(key));

CREATE TABLE IF NOT EXISTS public.guide_warning (
  id          serial PRIMARY KEY,
  card_id     int4 NOT NULL REFERENCES public.guide_card(id) ON DELETE CASCADE,
  text        varchar(300) NOT NULL,
  text_ta     varchar(400),
  icon        varchar(16),
  sort_order  int4 NOT NULL DEFAULT 100
);
CREATE INDEX IF NOT EXISTS guide_warning_card_idx ON public.guide_warning (card_id);

CREATE TABLE IF NOT EXISTS public.guide_option (
  id               serial PRIMARY KEY,
  card_id          int4 NOT NULL REFERENCES public.guide_card(id) ON DELETE CASCADE,
  composition      varchar(300) NOT NULL,            -- as in the brand dictionary: "Paracetamol 500 mg"
  composition_key  varchar(400),
  form             varchar(40),                      -- tablet, syrup ... (the dosage form list)
  audiences        text[] NOT NULL,                  -- child (2 to 12), adult, over60
  excludes         text[] NOT NULL DEFAULT '{}',     -- the "anything else" ticks this must not be given with
  guidance         text,                             -- how to take it, what to watch for: the pharmacist's words
  guidance_ta      text,
  sort_order       int4 NOT NULL DEFAULT 100
);
CREATE INDEX IF NOT EXISTS guide_option_card_idx ON public.guide_option (card_id);

ALTER TABLE public.guide_card ADD COLUMN IF NOT EXISTS icon varchar(16);
ALTER TABLE public.guide_warning ADD COLUMN IF NOT EXISTS icon varchar(16);

-- the Business Head and Owner-operator view, edit and approve cards; a pharmacist role is given the same actions in the role editor
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"counterguide","path":"/secure/settings/counter-guide","policies":[{"action":"view"},{"action":"manage"},{"action":"approve"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "counterguide")');
