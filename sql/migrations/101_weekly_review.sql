-- 101_weekly_review.sql
-- The weekly exceptions review: each week (Monday to Sunday) the people who run a store look at its discounts, cancelled bills and returns
-- and sign that they have. One sign-off per store per week; the snapshot keeps the figures as they stood when it was signed.

CREATE TABLE IF NOT EXISTS public.weekly_review (
  id           serial PRIMARY KEY,
  business_id  int4 NOT NULL REFERENCES public.business(id),
  store_id     int4 NOT NULL REFERENCES public.stores(id),
  week_start   date NOT NULL,
  reviewed_by  int4 NOT NULL REFERENCES public.app_user(id),
  reviewed_on  timestamptz NOT NULL DEFAULT now(),
  note         varchar(300),
  snapshot     jsonb,
  CONSTRAINT weekly_review_monday_chk CHECK (extract(isodow from week_start) = 1),
  CONSTRAINT weekly_review_once UNIQUE (store_id, week_start)
);

-- the people who run the shop may open the page
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"review","path":"/secure/review","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "review")');
