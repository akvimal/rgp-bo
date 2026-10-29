-- 112: recognition (RECOGNITION_AND_COMPLIANCE section 4, implementation plan stage 4).
--  * recognition_award: a badge earned by a person for a habit the data verifies, with the evidence that earned it. A badge stays until the habit breaks
--    (lapsed_on); earning it again later is a new row. seen_on is when the person was shown the celebration.
--  * recognition_note: a one-line thanks from the store head or Business Head to a person.
-- Who may read what is decided by the API: a person reads their own, the heads read the people of their stores. There is no ranking and no table of points.

CREATE TABLE IF NOT EXISTS public.recognition_award (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    person_id int4 NOT NULL,
    rule_key varchar(20) NOT NULL,
    awarded_on date NOT NULL,
    evidence jsonb NULL,
    seen_on timestamptz NULL,
    lapsed_on date NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT recognition_award_uq UNIQUE (business_id, person_id, rule_key, awarded_on)
);
CREATE INDEX IF NOT EXISTS recognition_award_person_idx ON public.recognition_award (person_id, lapsed_on);

CREATE TABLE IF NOT EXISTS public.recognition_note (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    from_user int4 NOT NULL,
    to_user int4 NOT NULL,
    text varchar(300) NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    seen_on timestamptz NULL
);
CREATE INDEX IF NOT EXISTS recognition_note_to_idx ON public.recognition_note (to_user, created_on DESC);
