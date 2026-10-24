-- 095: price policy.
--  * price_policy: per class (trade margin band LOW/MID/HIGH x profit rank A/B/C) the floor markup on cost and the deepest
--    discount off MRP. Seeded mild, from the 12-month study of production sales; the Business Head edits them.
--  * price_exception: the Business Head accepts one product's out-of-policy price until a date, so it leaves the review queue.
--  * app_setting pricing/*: how raises are stepped and who approves what.
CREATE TABLE IF NOT EXISTS public.price_policy (
  class_key         varchar(8) PRIMARY KEY,
  floor_markup_pct  numeric(6,2) NOT NULL,
  max_discount_pct  numeric(5,2) NOT NULL,
  updated_by        int4 NULL,
  updated_on        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_policy_key_chk CHECK (class_key ~ '^(LOW|MID|HIGH)_[ABC]$'),
  CONSTRAINT price_policy_floor_chk CHECK (floor_markup_pct >= 0 AND floor_markup_pct <= 1000),
  CONSTRAINT price_policy_cap_chk CHECK (max_discount_pct >= 0 AND max_discount_pct <= 95)
);

INSERT INTO public.price_policy (class_key, floor_markup_pct, max_discount_pct)
SELECT b.band || '_' || a.abc,
       CASE b.band WHEN 'HIGH' THEN 60 WHEN 'MID' THEN 25 ELSE 8 END,
       CASE b.band WHEN 'HIGH' THEN 80 WHEN 'MID' THEN 60 ELSE 20 END
  FROM (VALUES ('LOW'), ('MID'), ('HIGH')) b(band), (VALUES ('A'), ('B'), ('C')) a(abc)
ON CONFLICT (class_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.price_exception (
  id          serial PRIMARY KEY,
  product_id  int4 NOT NULL REFERENCES public.product(id),
  reason      varchar(200) NOT NULL,
  until_date  date NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_by  int4 NOT NULL REFERENCES public.app_user(id),
  created_on  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_exception_product_idx ON public.price_exception (product_id) WHERE active;

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES
  ('pricing', 'price_step_pct', '10', 'A price raise is at most this percent of the current price per step', true, false, 1, 1),
  ('pricing', 'price_step_mrp_pct', '5', 'A price raise is at most this percent of the GST-free MRP per step (the smaller limit applies)', true, false, 1, 1),
  ('pricing', 'price_step_days', '14', 'A product price is raised at most once in this many days', true, false, 1, 1),
  ('pricing', 'price_store_head_limit_pct', '15', 'A Store Head may approve a price change up to this percent; more needs the Business Head', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
