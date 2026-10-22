-- 065_stock_audit.sql
-- Routine stock audits. A plan says how often a store's stock is physically counted and what: everything, one category,
-- or a rotation through categories so that every category is covered over the cycle. Each cycle produces an audit with a due
-- date and an assignee; doing it uses the existing stock count (which raises the adjustments for a manager to approve) and
-- the audit records what the count found. Overdue and skipped audits are visible, and feed the KPI.

CREATE TABLE IF NOT EXISTS public.stock_audit_plan (
  id             serial PRIMARY KEY,
  name           varchar(60) NOT NULL,
  store_id       int4 REFERENCES public.stores(id),            -- null = every active store
  scope          varchar(8) NOT NULL DEFAULT 'ALL',
  categories     text[],                                         -- CATEGORY: the one; ROTATE: the order to go through
  frequency_days int4 NOT NULL,
  first_due      date NOT NULL,
  assigned_to    int4 REFERENCES public.app_user(id),
  active         boolean NOT NULL DEFAULT true,
  created_by     int4 REFERENCES public.app_user(id),
  created_on     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_audit_plan_scope_chk CHECK (scope IN ('ALL', 'CATEGORY', 'ROTATE')),
  CONSTRAINT stock_audit_plan_freq_chk  CHECK (frequency_days BETWEEN 1 AND 366)
);

CREATE TABLE IF NOT EXISTS public.stock_audit (
  id             serial PRIMARY KEY,
  plan_id        int4 REFERENCES public.stock_audit_plan(id),
  store_id       int4 NOT NULL REFERENCES public.stores(id),
  category       varchar(60),
  due_on         date NOT NULL,
  status         varchar(11) NOT NULL DEFAULT 'PLANNED',
  assigned_to    int4 REFERENCES public.app_user(id),
  count_id       int4 REFERENCES public.stock_count(id),
  started_on     timestamptz,
  completed_on   timestamptz,
  completed_by   int4 REFERENCES public.app_user(id),
  lines_counted  int4,
  lines_changed  int4,
  variance_units int4,
  variance_value numeric(12,2),
  note           varchar(200),
  created_on     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_audit_status_chk CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'SKIPPED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_audit_plan_store_due_uq ON public.stock_audit (plan_id, store_id, due_on) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_audit_open_idx ON public.stock_audit (status, due_on);
CREATE INDEX IF NOT EXISTS stock_audit_assignee_idx ON public.stock_audit (assigned_to, status);

-- Business Head: plans and everything. Store Head: see and carry out the audits of their stores (counting needs the stock-audit permission the Store Head already has).
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"stockaudit","path":"/secure/stock-audits","policies":[{"action":"view"},{"action":"perform"},{"action":"manage"}]}]'::jsonb)::json
WHERE name = 'Business Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "stockaudit")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"stockaudit","path":"/secure/stock-audits","policies":[{"action":"view"},{"action":"perform"}]}]'::jsonb)::json
WHERE name = 'Store Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "stockaudit")');
