-- 202: a daily roll-up of the money_flow view, so the category x month matrix does not read every bill line for older months
-- (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.3). The app refreshes it each night: the first run builds all history, later runs rebuild the last
-- 100 days. The matrix reads it only for whole months older than three months and only while `metric_daily_state.through` covers them; anything newer,
-- and everything when the roll-up has never been built, is read live from money_flow, so a missing or stale roll-up never changes a figure.
CREATE TABLE IF NOT EXISTS public.metric_daily (
  flow_date    date NOT NULL,
  store_id     int4,
  flow_class   varchar(20) NOT NULL,
  grp          varchar(40) NOT NULL,
  category     varchar(120) NOT NULL,
  amount       numeric(14,2) NOT NULL,
  gst          numeric(14,2) NOT NULL,
  entries      int4 NOT NULL,
  unclassified boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS metric_daily_date_idx ON public.metric_daily (flow_date, store_id);

CREATE TABLE IF NOT EXISTS public.metric_daily_state (
  id        int4 PRIMARY KEY CHECK (id = 1),
  through   date,
  built_on  timestamptz,
  full_on   timestamptz
);
INSERT INTO public.metric_daily_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
