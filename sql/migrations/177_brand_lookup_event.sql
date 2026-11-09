-- 177: brand checks at the counter. When staff press "Check brand" and pick a brand (from the brand dictionary or from our own list), or type one nothing
-- matches, what they found is kept: in stock (same composition and form), only in another form, or nothing in stock. The weekly review counts the ones
-- with no match as unmet demand and lists the brands most asked for. The name, composition and form are copied at the time (the dictionary may be
-- replaced by a newer release). No foreign keys to the dictionary for the same reason. Re-runnable.
CREATE TABLE IF NOT EXISTS public.brand_lookup_event (
  id           serial4 PRIMARY KEY,
  store_id     int4 NULL,
  user_id      int4 NULL,
  kind         varchar(8) NOT NULL,     -- BRAND (picked from the dictionary), PRODUCT (picked from our list), TYPED (typed, nothing found)
  text         varchar(160) NOT NULL,   -- the brand or product name shown, or the text typed
  composition  varchar(300) NULL,
  form         varchar(20) NULL,
  brand_id     int4 NULL,
  product_id   int4 NULL,
  outcome      varchar(12) NOT NULL,    -- IN_STOCK, OTHER_FORM, NOT_STOCKED, NO_COMP (no composition to match on), NOT_FOUND (typed, nothing found)
  created_on   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_lookup_kind_chk CHECK (kind IN ('BRAND', 'PRODUCT', 'TYPED')),
  CONSTRAINT brand_lookup_outcome_chk CHECK (outcome IN ('IN_STOCK', 'OTHER_FORM', 'NOT_STOCKED', 'NO_COMP', 'NOT_FOUND'))
);
CREATE INDEX IF NOT EXISTS brand_lookup_store_day_idx ON public.brand_lookup_event (store_id, created_on);
