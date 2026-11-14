-- 200: health findings (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 4)
-- The findings themselves are worked out live from facts the app already holds. Two small tables remember what a live query cannot:
--   health_finding_state : when a finding was first seen (so it can age from Minor to Major), and a snooze with its reason and end date
--   health_snapshot      : one row per day, business and area, with the score and the counts by severity, for the trend line
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.health_finding_state (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    fkey varchar(160) NOT NULL,
    first_seen date NOT NULL DEFAULT current_date,
    last_seen date NOT NULL DEFAULT current_date,
    snoozed_until date NULL,
    snooze_reason varchar(300) NULL,
    snoozed_by int4 NULL,
    snoozed_on timestamptz NULL,
    CONSTRAINT health_finding_state_uk UNIQUE (business_id, fkey)
);

CREATE TABLE IF NOT EXISTS public.health_snapshot (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    store_id int4 NOT NULL DEFAULT 0,        -- 0 = the whole business
    snap_date date NOT NULL,
    area varchar(20) NOT NULL,               -- an area key, or 'all' for the overall score
    score int4 NOT NULL,
    critical int4 NOT NULL DEFAULT 0,
    major int4 NOT NULL DEFAULT 0,
    minor int4 NOT NULL DEFAULT 0,
    CONSTRAINT health_snapshot_uk UNIQUE (business_id, store_id, snap_date, area)
);
CREATE INDEX IF NOT EXISTS health_snapshot_date_idx ON public.health_snapshot (business_id, snap_date);
