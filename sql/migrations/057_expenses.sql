-- 057_expenses.sql
-- Expense ledger at business and store level: rent, salaries, utilities and the rest, paid by cash / bank / UPI / card /
-- cheque, with approval. A store expense raised by the Store Head within the store limit is approved on the spot; above
-- the limit, and every business-level expense, the Business Head approves. Counter staff can raise a store expense for the
-- Store Head to approve. Till expenses on the Cash screen stay where they are and are added in the report.
--   expense_category   configurable list
--   expense            the ledger (store_id null = business level)
--   expense_recurring  rent / salaries / utilities templates; "generate the month" creates the entries once

CREATE TABLE IF NOT EXISTS public.expense_category (
  id            serial PRIMARY KEY,
  name          varchar(60) NOT NULL UNIQUE,
  display_order int4 NOT NULL DEFAULT 10,
  active        boolean NOT NULL DEFAULT true
);
INSERT INTO public.expense_category (name, display_order) VALUES
  ('Rent', 1), ('Salaries', 2), ('Electricity', 3), ('Water', 4), ('Internet and phone', 5), ('Repairs and maintenance', 6),
  ('Transport and courier', 7), ('Cleaning', 8), ('Stationery and printing', 9), ('Licences and fees', 10),
  ('Professional fees', 11), ('Marketing', 12), ('Insurance', 13), ('Other', 99)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.expense_recurring (
  id            serial PRIMARY KEY,
  category_id   int4 NOT NULL REFERENCES public.expense_category(id),
  store_id      int4 REFERENCES public.stores(id),
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  payee         varchar(100),
  pay_mode      varchar(8) NOT NULL DEFAULT 'BANK',
  description   varchar(300),
  day_of_month  int4 NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  start_month   char(7) NOT NULL,
  end_month     char(7),
  active        boolean NOT NULL DEFAULT true,
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_recurring_mode_chk CHECK (pay_mode IN ('CASH', 'BANK', 'UPI', 'CARD', 'CHEQUE'))
);

CREATE TABLE IF NOT EXISTS public.expense (
  id            serial PRIMARY KEY,
  expense_date  date NOT NULL,
  store_id      int4 REFERENCES public.stores(id),
  category_id   int4 NOT NULL REFERENCES public.expense_category(id),
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  gst_amount    numeric(10,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  payee         varchar(100),
  bill_no       varchar(40),
  pay_mode      varchar(8) NOT NULL,
  description   varchar(300),
  receipt_path  varchar(300),
  status        varchar(10) NOT NULL DEFAULT 'PENDING',
  raised_by     int4 NOT NULL,
  decided_by    int4,
  decided_on    timestamptz,
  decision_note varchar(200),
  recurring_id  int4 REFERENCES public.expense_recurring(id),
  recurring_period char(7),
  created_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_mode_chk   CHECK (pay_mode IN ('CASH', 'BANK', 'UPI', 'CARD', 'CHEQUE')),
  CONSTRAINT expense_status_chk CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT expense_gst_chk    CHECK (gst_amount <= amount)
);
CREATE UNIQUE INDEX IF NOT EXISTS expense_recurring_period_uq ON public.expense (recurring_id, recurring_period) WHERE recurring_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS expense_date_idx ON public.expense (expense_date);
CREATE INDEX IF NOT EXISTS expense_status_idx ON public.expense (status, store_id);

-- the limit a Store Head can approve on their own (Rs); the Business Head changes it under Expenses > Setup
INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive)
SELECT 'expense', 'store_head_limit', '5000', 'Largest store expense a Store Head can approve; above it the Business Head approves', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE category = 'expense' AND setting_key = 'store_head_limit');

-- permissions: Business Head everything; Store Head view / add / approve; Sales Staff view (own) / add
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"expenses","path":"/secure/expenses","policies":[{"action":"view"},{"action":"add"},{"action":"approve"},{"action":"manage"}]}]'::jsonb)::json
WHERE name = 'Business Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "expenses")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"expenses","path":"/secure/expenses","policies":[{"action":"view"},{"action":"add"},{"action":"approve"}]}]'::jsonb)::json
WHERE name = 'Store Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "expenses")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"expenses","path":"/secure/expenses","policies":[{"action":"view"},{"action":"add"}]}]'::jsonb)::json
WHERE name = 'Sales Staff' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "expenses")');
