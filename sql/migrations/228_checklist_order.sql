-- 228: the order the checklists are shown in (the buttons on the Checklists page and in Settings > Checklists). A store may keep its own order; the owner may set
-- one for every store that has none; with neither, the order shipped in code applies. `keys` is the list of checklist keys, first to last; a checklist not named
-- in it (one added later) comes after. Rollback: 228_rollback.sql.
CREATE TABLE IF NOT EXISTS public.checklist_order (
  id          serial PRIMARY KEY,
  business_id int4 NOT NULL REFERENCES public.business(id),
  store_id    int4 NULL REFERENCES public.stores(id),           -- null = the business's order
  keys        jsonb NOT NULL,
  updated_by  int4 NULL REFERENCES public.app_user(id),
  updated_on  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_order_uq ON public.checklist_order (business_id, COALESCE(store_id, 0));
