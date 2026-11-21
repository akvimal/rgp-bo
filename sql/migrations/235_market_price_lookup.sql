-- 235: what the online (AI web search) market price lookup found for a composition, kept so the same composition is not searched (and paid for) again within a month.
-- Keyed by the composition and dosage form, not by a product or brand: any product or brand with that composition shares the answer.
-- The answer was read from web pages by a model and checked by rules; it is indicative and carries its source links.
CREATE TABLE IF NOT EXISTS public.market_price_lookup (
  id            serial PRIMARY KEY,
  lookup_key    varchar(400) NOT NULL,           -- composition key + '|' + dosage form, for example 'telmisartan40mg|tablet'
  composition   varchar(400) NOT NULL,           -- the composition as asked, for example 'Telmisartan 40 mg'
  form          varchar(40),
  found         boolean NOT NULL,
  answer        jsonb NOT NULL,                  -- the checked answer: listings (brand, site, pack, MRP, selling price), the range, note, source links
  model         varchar(120),
  looked_up_on  timestamp NOT NULL DEFAULT now(),
  looked_up_by  int4
);
CREATE UNIQUE INDEX IF NOT EXISTS market_price_lookup_key_uq ON public.market_price_lookup (lookup_key);
