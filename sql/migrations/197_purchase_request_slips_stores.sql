-- 197: purchase requests, phase A (docs/planning/PURCHASE_REQUEST_SLIPS_AND_STORES.md)
--   purchase_request_group     a "slip": several products asked for at once; the shared fields are copied onto each row, so nothing downstream changes
--   purchase_request.group_id  which slip a row belongs to (NULL for a single request)
--   purchase_request.store_id  the store that asked (so a store's staff see their store's requests and the buyer can filter and split by store)
-- Backfill: the store of the request's creator (the primary one, else the lowest id); a request whose creator has no store stays NULL ("unassigned").
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.purchase_request_group (
  id         serial PRIMARY KEY,
  store_id   int4 NULL REFERENCES public.stores(id),
  note       varchar(500) NULL,
  created_by int4 NULL,
  created_on timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_request ADD COLUMN IF NOT EXISTS group_id int4 NULL REFERENCES public.purchase_request_group(id);
ALTER TABLE public.purchase_request ADD COLUMN IF NOT EXISTS store_id int4 NULL REFERENCES public.stores(id);
CREATE INDEX IF NOT EXISTS purchase_request_group_idx ON public.purchase_request (group_id);
CREATE INDEX IF NOT EXISTS purchase_request_store_idx ON public.purchase_request (store_id);

UPDATE public.purchase_request pr SET store_id = x.store_id
  FROM (SELECT DISTINCT ON (us.user_id) us.user_id, us.store_id FROM public.user_stores us
         JOIN public.stores s ON s.id = us.store_id AND s.active AND NOT s.archive
        WHERE us.active AND NOT us.archive ORDER BY us.user_id, us.is_primary DESC, us.store_id) x
 WHERE pr.store_id IS NULL AND pr.created_by = x.user_id;

-- a creator with no store of their own (an owner) in a business that has exactly one store: that store
UPDATE public.purchase_request pr SET store_id = x.store_id
  FROM (SELECT u.id AS user_id, (array_agg(s.id))[1] AS store_id FROM public.app_user u
         JOIN public.stores s ON s.business_id = u.business_id AND s.active AND NOT s.archive
        GROUP BY u.id HAVING count(*) = 1) x
 WHERE pr.store_id IS NULL AND pr.created_by = x.user_id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.purchase_request WHERE store_id IS NULL AND active AND NOT archive;
  RAISE NOTICE 'requests left without a store (the buyer assigns them): %', n;
END $$;
