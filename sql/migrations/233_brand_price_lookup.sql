-- 233: what the online price lookup found for a brand from the dictionary, kept so the same brand is not searched (and paid for) again within a month.
-- Keyed by the brand text, not by the dictionary row: loading a newer dictionary replaces its rows, and a kept price should survive that.
-- The answer was read from web pages by a model and checked by rules; it is indicative and carries its source links.
CREATE TABLE IF NOT EXISTS public.brand_price_lookup (
  id            serial PRIMARY KEY,
  brand_key     varchar(200) NOT NULL,          -- lower-cased brand text, for example 'telmiten 40 mg oral tablet'
  brand         varchar(200) NOT NULL,
  found         boolean NOT NULL,
  answer        jsonb NOT NULL,                  -- the checked answer: pack, MRP, selling range, per-unit prices, note, source links
  model         varchar(120),
  looked_up_on  timestamp NOT NULL DEFAULT now(),
  looked_up_by  int4
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_price_lookup_key_uq ON public.brand_price_lookup (brand_key);
