-- 040_grievances.sql
-- Customer grievances: logged at the counter or by phone, assigned, resolved within a due date, with a
-- timeline of notes. Visible to Business Head (all stores) and Store Head (own stores).

CREATE TABLE IF NOT EXISTS public.grievance (
  id            serial PRIMARY KEY,
  store_id      int4 NOT NULL REFERENCES public.stores(id),
  customer_id   int4 NULL REFERENCES public.customer(id),
  sale_id       int4 NULL REFERENCES public.sale(id),
  about_user_id int4 NULL REFERENCES public.app_user(id),   -- staff member the complaint concerns
  category      text NOT NULL,
  severity      text NOT NULL DEFAULT 'MEDIUM',
  source        text NOT NULL DEFAULT 'COUNTER',
  summary       text NOT NULL,
  description   text NULL,
  status        text NOT NULL DEFAULT 'OPEN',
  assigned_to   int4 NULL REFERENCES public.app_user(id),
  due_on        date NOT NULL,
  resolution    text NULL,
  resolved_on   timestamptz NULL,
  resolved_by   int4 NULL REFERENCES public.app_user(id),
  created_on    timestamptz NOT NULL DEFAULT now(),
  created_by    int4 NOT NULL REFERENCES public.app_user(id),
  updated_on    timestamptz NOT NULL DEFAULT now(),
  updated_by    int4 NULL REFERENCES public.app_user(id),
  CONSTRAINT grievance_status_chk   CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  CONSTRAINT grievance_severity_chk CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  CONSTRAINT grievance_source_chk   CHECK (source IN ('COUNTER','PHONE','WHATSAPP','DELIVERY','OTHER')),
  CONSTRAINT grievance_category_chk CHECK (category IN ('SERVICE','PRODUCT_QUALITY','WRONG_ITEM','PRICING','STOCK','DELIVERY','OTHER')),
  CONSTRAINT grievance_resolved_chk CHECK (status NOT IN ('RESOLVED','CLOSED') OR (resolution IS NOT NULL AND resolved_on IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS grievance_store_status_idx ON public.grievance (store_id, status);
CREATE INDEX IF NOT EXISTS grievance_due_idx          ON public.grievance (due_on) WHERE status IN ('OPEN','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS grievance_about_idx        ON public.grievance (about_user_id);
CREATE INDEX IF NOT EXISTS grievance_customer_idx     ON public.grievance (customer_id);

CREATE TABLE IF NOT EXISTS public.grievance_note (
  id           serial PRIMARY KEY,
  grievance_id int4 NOT NULL REFERENCES public.grievance(id) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'NOTE',   -- NOTE, STATUS, ASSIGN
  note         text NOT NULL,
  created_on   timestamptz NOT NULL DEFAULT now(),
  created_by   int4 NOT NULL REFERENCES public.app_user(id)
);
CREATE INDEX IF NOT EXISTS grievance_note_idx ON public.grievance_note (grievance_id, created_on);

-- front-end nav / route guard read the role's permissions JSON
UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"grievances","path":"/secure/quality/grievances","policies":[{"action":"view"},{"action":"add"},{"action":"manage"}]}]'::jsonb
)::json
WHERE name IN ('Business Head', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "grievances")');
