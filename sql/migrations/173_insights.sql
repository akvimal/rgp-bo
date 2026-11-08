-- The insight features: the weekly owner summary and the staff coaching notes.
--  * weekly_summary: one row per Monday-to-Sunday week, the figures it was made from and the words (written by the assistant or in plain words).
--  * hr_coaching_note: one note per person per month for a manager to talk through; shared with the person only when the manager chooses.
CREATE TABLE IF NOT EXISTS public.weekly_summary (
  id          serial PRIMARY KEY,
  week_start  date NOT NULL UNIQUE,
  week_end    date NOT NULL,
  facts       jsonb NOT NULL,
  headline    text,
  wins        jsonb NOT NULL DEFAULT '[]'::jsonb,
  watch       jsonb NOT NULL DEFAULT '[]'::jsonb,
  do_first    jsonb NOT NULL DEFAULT '[]'::jsonb,
  source      varchar(10) NOT NULL DEFAULT 'plain',
  created_on  timestamptz NOT NULL DEFAULT now(),
  created_by  int4,
  sent_on     timestamptz,
  sent_to     int4 NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.hr_coaching_note (
  id           serial PRIMARY KEY,
  employee_id  int4 NOT NULL REFERENCES public.hr_employee(id),
  period       varchar(7) NOT NULL,
  facts        jsonb NOT NULL,
  strengths    jsonb NOT NULL DEFAULT '[]'::jsonb,
  focus        jsonb NOT NULL DEFAULT '[]'::jsonb,
  tips         jsonb NOT NULL DEFAULT '[]'::jsonb,
  talk_points  jsonb NOT NULL DEFAULT '[]'::jsonb,
  source       varchar(10) NOT NULL DEFAULT 'plain',
  shared       boolean NOT NULL DEFAULT false,
  shared_on    timestamptz,
  created_on   timestamptz NOT NULL DEFAULT now(),
  created_by   int4,
  updated_on   timestamptz NOT NULL DEFAULT now(),
  updated_by   int4,
  UNIQUE (employee_id, period)
);
CREATE INDEX IF NOT EXISTS hr_coaching_note_employee_idx ON public.hr_coaching_note (employee_id, period DESC);
