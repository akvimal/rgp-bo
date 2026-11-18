-- 223: store checklists and system tasks. The outage kit page is taken apart:
--   * the weekly readiness check becomes one of several configurable checklists kept per store (checklist_template; a store row wins over a
--     business row, which wins over the lists shipped in code), each filled in as a checklist_run;
--   * the weekly and monthly jobs the system itself asks a store to do (print the price list, weekly review, stock count...) are ordinary repeating
--     store-pool to-dos marked with system_key, switched on or off and moved to another day per store (system_task_setting);
--   * the outage log is retired (outage_event is left in place, unused).
-- Rollback: 223_rollback.sql.
CREATE TABLE IF NOT EXISTS public.checklist_template (
  id           serial PRIMARY KEY,
  business_id  int4 NOT NULL REFERENCES public.business(id),
  store_id     int4 NULL REFERENCES public.stores(id),          -- null = the business default
  key          varchar(40) NOT NULL,
  title        varchar(120) NOT NULL,
  items        jsonb NOT NULL,                                   -- [{key, label, kind: 'tick'|'text', auto?: 'price_list'}]
  active       boolean NOT NULL DEFAULT true,
  updated_by   int4 NULL REFERENCES public.app_user(id),
  updated_on   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_template_uq ON public.checklist_template (business_id, COALESCE(store_id, 0), key);

CREATE TABLE IF NOT EXISTS public.checklist_run (
  id             serial PRIMARY KEY,
  business_id    int4 NOT NULL,
  store_id       int4 NULL REFERENCES public.stores(id),
  template_key   varchar(40) NOT NULL,
  template_title varchar(120) NOT NULL,
  run_by         int4 NOT NULL REFERENCES public.app_user(id),
  run_on         timestamptz NOT NULL DEFAULT now(),
  items          jsonb NOT NULL,                                 -- [{key, label, ticked, value?}]: the wording as it was when ticked
  complete       boolean NOT NULL,
  note           varchar(300) NULL
);
CREATE INDEX IF NOT EXISTS checklist_run_store_idx ON public.checklist_run (store_id, template_key, run_on DESC);

CREATE TABLE IF NOT EXISTS public.system_task_setting (
  id           serial PRIMARY KEY,
  business_id  int4 NOT NULL REFERENCES public.business(id),
  store_id     int4 NULL REFERENCES public.stores(id),           -- null = the whole business
  task_key     varchar(40) NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  day          int4 NULL,                                        -- weekly: 0 = Sunday ... 6; monthly: day of the month, 0 = the last day
  updated_by   int4 NULL REFERENCES public.app_user(id),
  updated_on   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS system_task_setting_uq ON public.system_task_setting (business_id, COALESCE(store_id, 0), task_key);

-- a to-do made by the system carries its task key and the page where the work is done
ALTER TABLE public.todo_template ADD COLUMN IF NOT EXISTS system_key varchar(40) NULL;
ALTER TABLE public.todo_template ADD COLUMN IF NOT EXISTS link varchar(160) NULL;
ALTER TABLE public.todo_item ADD COLUMN IF NOT EXISTS system_key varchar(40) NULL;
ALTER TABLE public.todo_item ADD COLUMN IF NOT EXISTS link varchar(160) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS todo_template_system_uq ON public.todo_template (business_id, COALESCE(store_id, 0), system_key) WHERE system_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS todo_item_system_idx ON public.todo_item (business_id, system_key) WHERE system_key IS NOT NULL AND status = 'OPEN';

-- the weekly readiness checks already made carry over as runs of the outage readiness checklist
INSERT INTO public.checklist_run (business_id, store_id, template_key, template_title, run_by, run_on, items, complete, note)
SELECT l.business_id, l.store_id, 'outage_readiness', 'Outage readiness', l.checked_by, l.checked_on, l.items, l.complete,
       NULLIF(concat_ws(' | ', CASE WHEN l.bill_book_last IS NOT NULL THEN 'Last bill book number ' || l.bill_book_last END, l.note), '')
  FROM public.outage_readiness_log l
 WHERE NOT EXISTS (SELECT 1 FROM public.checklist_run r WHERE r.template_key = 'outage_readiness' AND r.run_on = l.checked_on AND r.run_by = l.checked_by);

-- permissions: everyone who billed the outage kit keeps the page (now Checklists); the people who run the shop may also change the lists and tasks
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"checklists","path":"/secure/checklists","policies":[{"action":"view"},{"action":"edit"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "checklists")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"checklists","path":"/secure/checklists","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Sales Staff', 'Counter')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "checklists")');
