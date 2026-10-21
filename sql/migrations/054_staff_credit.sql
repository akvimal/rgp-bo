-- 054_staff_credit.sql
-- Staff buy on credit and it is taken from their salary. Salary itself is worked out in Excel outside the app, so the
-- app keeps the ledger: what each person took on credit (bills paid by "staff credit"), what was recovered, and the
-- balance still to recover. The Business Head sets a monthly cap per person; a bill that would pass it is refused.
--   staff_credit_limit   monthly cap per person (no row or 0 = no staff credit allowed)
--   staff_credit_entry   CREDIT (+, from a bill) / RECOVERY (-, taken from salary) / ADJUSTMENT (+ or -, with a note)
--   sale.staff_credit_*  the part of a bill paid on staff credit and whose it is

ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS staff_credit_amount real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_credit_user_id int4 REFERENCES public.app_user(id);

CREATE TABLE IF NOT EXISTS public.staff_credit_limit (
  user_id     int4 PRIMARY KEY REFERENCES public.app_user(id),
  monthly_cap numeric(10,2) NOT NULL CHECK (monthly_cap >= 0),
  set_by      int4,
  set_on      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_credit_entry (
  id          serial PRIMARY KEY,
  user_id     int4 NOT NULL REFERENCES public.app_user(id),
  entry_date  date NOT NULL DEFAULT current_date,
  kind        varchar(12) NOT NULL,
  amount      numeric(10,2) NOT NULL,
  period      char(7) NOT NULL,                    -- the salary month the entry belongs to, YYYY-MM
  sale_id     int4,
  store_id    int4,
  note        varchar(200),
  created_by  int4,
  created_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_credit_entry_kind_chk CHECK (kind IN ('CREDIT', 'RECOVERY', 'ADJUSTMENT')),
  CONSTRAINT staff_credit_entry_sign_chk CHECK ((kind = 'CREDIT' AND amount > 0) OR (kind = 'RECOVERY' AND amount < 0) OR (kind = 'ADJUSTMENT' AND amount <> 0)),
  CONSTRAINT staff_credit_entry_period_chk CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_credit_sale_uq ON public.staff_credit_entry (sale_id) WHERE kind = 'CREDIT' AND sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_credit_entry_user_idx ON public.staff_credit_entry (user_id, period);

-- the Business Head manages it; the page lives under Staff & Quality
UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"staffcredit","path":"/secure/quality/staff-credit","policies":[{"action":"view"},{"action":"manage"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "staffcredit")');
