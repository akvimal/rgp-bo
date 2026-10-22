-- 066_sale_suggestions.sql
-- Cross-sell and up-sell prompts at the till. Suggestions are worked out from what customers bought together before and from
-- stock (same composition with a better margin, a longer supply for chronic medicines). Each time one is shown, added or
-- dismissed it is logged, so the acceptance rate can be measured per person (KPI SUGGESTIONS_ADDED) and per kind.

CREATE TABLE IF NOT EXISTS public.sale_suggestion_event (
  id                   serial PRIMARY KEY,
  store_id             int4 REFERENCES public.stores(id),
  user_id              int4 NOT NULL REFERENCES public.app_user(id),
  kind                 varchar(16) NOT NULL,
  action               varchar(9) NOT NULL,
  anchor_product_id    int4,
  suggested_product_id int4,
  detail               varchar(120),
  created_on           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_suggestion_kind_chk   CHECK (kind IN ('CROSS_SELL', 'SAME_COMPOSITION', 'BULK_SUPPLY')),
  CONSTRAINT sale_suggestion_action_chk CHECK (action IN ('SHOWN', 'ADDED', 'DISMISSED'))
);
CREATE INDEX IF NOT EXISTS sale_suggestion_user_idx ON public.sale_suggestion_event (user_id, created_on);
CREATE INDEX IF NOT EXISTS sale_item_product_idx ON public.sale_item (product_id);
CREATE INDEX IF NOT EXISTS sale_item_sale_idx ON public.sale_item (sale_id);
