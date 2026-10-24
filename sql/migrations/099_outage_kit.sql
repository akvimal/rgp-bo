-- 099: the outage kit. A shop that loses power or its connection keeps selling by hand from a printed price list and a bill book, then enters
-- the bills afterwards. This keeps (1) a weekly record that the kit is ready (who checked what, when), and (2) a log of each outage and the
-- manual bill numbers used, so the shop can see how often it happens and no bill is lost. The page is open to everyone who bills.
CREATE TABLE IF NOT EXISTS public.outage_readiness_log (
  id             serial PRIMARY KEY,
  business_id    int4 NOT NULL,
  store_id       int4 NULL REFERENCES public.stores(id),
  checked_by     int4 NOT NULL REFERENCES public.app_user(id),
  checked_on     timestamptz NOT NULL DEFAULT now(),
  items          jsonb NOT NULL,                       -- [{key, label, ticked}]: the wording as it was when ticked
  complete       boolean NOT NULL,                     -- every item ticked
  bill_book_last varchar(40) NULL,                     -- the last number used in the manual bill book
  note           varchar(300) NULL
);
CREATE INDEX IF NOT EXISTS outage_readiness_store_idx ON public.outage_readiness_log (store_id, checked_on DESC);

CREATE TABLE IF NOT EXISTS public.outage_event (
  id            serial PRIMARY KEY,
  business_id   int4 NOT NULL,
  store_id      int4 NULL REFERENCES public.stores(id),
  started_on    timestamptz NOT NULL,
  ended_on      timestamptz NULL,
  cause         varchar(10) NOT NULL,
  manual_from   varchar(40) NULL,                      -- first and last manual bill number used in this outage
  manual_to     varchar(40) NULL,
  manual_count  int4 NULL,
  note          varchar(300) NULL,
  entered_by    int4 NOT NULL REFERENCES public.app_user(id),
  entered_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outage_event_cause_chk CHECK (cause IN ('POWER', 'INTERNET', 'SERVER', 'OTHER')),
  CONSTRAINT outage_event_order_chk CHECK (ended_on IS NULL OR ended_on >= started_on),
  CONSTRAINT outage_event_count_chk CHECK (manual_count IS NULL OR manual_count >= 0)
);
CREATE INDEX IF NOT EXISTS outage_event_store_idx ON public.outage_event (store_id, started_on DESC);

-- everyone who bills (and the people who run the shop) may open the page
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"outage","path":"/secure/outage","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head', 'Sales Staff', 'Counter')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "outage")');
