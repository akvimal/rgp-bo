-- 142: the weekly knowledge check. A person takes five questions a week (one scored attempt a week, practice any time); each answer is kept so weak topics
-- can be coached. Nothing here is part of a KPI.
CREATE TABLE IF NOT EXISTS public.kc_attempt (
    id serial4 PRIMARY KEY,
    user_id int4 NOT NULL REFERENCES public.app_user(id),
    business_id int4 NULL,
    store_id int4 NULL,
    kind varchar(8) NOT NULL,
    week_start date NOT NULL,
    question_ids text[] NOT NULL,
    option_orders jsonb NOT NULL DEFAULT '{}'::jsonb,
    bank_version varchar(10) NULL,
    started_on timestamptz NOT NULL DEFAULT now(),
    finished_on timestamptz NULL,
    score int4 NULL,
    total int4 NULL,
    passed boolean NULL,
    CONSTRAINT kc_attempt_kind_chk CHECK (kind IN ('SCORED', 'PRACTICE'))
);
-- one scored attempt a week for each person (a started one can be resumed)
CREATE UNIQUE INDEX IF NOT EXISTS kc_attempt_week_uq ON public.kc_attempt (user_id, week_start) WHERE kind = 'SCORED';
CREATE INDEX IF NOT EXISTS kc_attempt_user_idx ON public.kc_attempt (user_id, finished_on DESC);
CREATE INDEX IF NOT EXISTS kc_attempt_business_idx ON public.kc_attempt (business_id, week_start);

CREATE TABLE IF NOT EXISTS public.kc_answer (
    id bigserial PRIMARY KEY,
    attempt_id int4 NOT NULL REFERENCES public.kc_attempt(id) ON DELETE CASCADE,
    question_id varchar(30) NOT NULL,
    topic varchar(20) NOT NULL,
    chosen int4 NOT NULL,
    correct boolean NOT NULL,
    answered_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT kc_answer_once_uq UNIQUE (attempt_id, question_id)
);
