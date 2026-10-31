-- 128: Working down the Pack check list.
--  * pack_check_resolution: one row each time someone settles a flagged product, either "the pack is correct" (DISMISSED, with the reason)
--    or "the pack was changed" (FIXED, with the old and new pack and the reason). The flags come from purchase and price history, which a
--    correction does not change, so a product with a resolution is left off the open list until a purchase or price AFTER that day
--    shows a new problem. The rows stay as a history of who decided what.
CREATE TABLE IF NOT EXISTS public.pack_check_resolution (
  id          serial PRIMARY KEY,
  product_id  int4 NOT NULL REFERENCES public.product(id),
  action      text NOT NULL,
  reason      text NOT NULL,
  note        text NULL,
  old_pack    int4 NULL,
  new_pack    int4 NULL,
  created_on  timestamptz NOT NULL DEFAULT now(),
  created_by  int4 NOT NULL REFERENCES public.app_user(id),
  CONSTRAINT pack_check_resolution_action_chk CHECK (action IN ('DISMISSED', 'FIXED'))
);
CREATE INDEX IF NOT EXISTS pack_check_resolution_product_idx ON public.pack_check_resolution (product_id, id DESC);
