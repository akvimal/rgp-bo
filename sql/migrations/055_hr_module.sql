-- 055_hr_module.sql
-- Mini HR for the Business Head: staff records, pay components and dated salary revisions, leave (paid / unpaid),
-- attendance, KPI scoring and the monthly payroll run with pay stubs. Pay is a fixed 30-day month.
-- New hr_* tables only; the old unused payroll_* / employee_salary_structure tables are left alone.

CREATE TABLE IF NOT EXISTS public.hr_employee (
  id            serial PRIMARY KEY,
  user_id       int4 UNIQUE REFERENCES public.app_user(id),
  emp_code      varchar(20) NOT NULL UNIQUE,
  designation   varchar(60),
  store_id      int4,
  emp_type      varchar(12) NOT NULL DEFAULT 'FULL_TIME',
  join_date     date NOT NULL,
  exit_date     date,
  status        varchar(10) NOT NULL DEFAULT 'ACTIVE',
  weekly_off    varchar(10) NOT NULL DEFAULT 'SUNDAY',      -- SUNDAY (fixed) or ROTATION (marked in attendance)
  dob           date,
  address       varchar(300),
  emergency_name  varchar(80),
  emergency_phone varchar(20),
  pan           varchar(10),
  aadhaar_last4 char(4),
  bank_name     varchar(60),
  account_no    varchar(30),
  ifsc          varchar(15),
  notes         varchar(300),
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  updated_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_employee_type_chk   CHECK (emp_type IN ('FULL_TIME', 'PART_TIME')),
  CONSTRAINT hr_employee_status_chk CHECK (status IN ('ACTIVE', 'EXITED')),
  CONSTRAINT hr_employee_off_chk    CHECK (weekly_off IN ('SUNDAY', 'ROTATION'))
);

CREATE TABLE IF NOT EXISTS public.hr_pay_component (
  id            serial PRIMARY KEY,
  code          varchar(20) NOT NULL UNIQUE,
  name          varchar(60) NOT NULL,
  kind          varchar(10) NOT NULL,                        -- EARNING / DEDUCTION
  display_order int4 NOT NULL DEFAULT 10,
  active        boolean NOT NULL DEFAULT true,
  CONSTRAINT hr_pay_component_kind_chk CHECK (kind IN ('EARNING', 'DEDUCTION'))
);
INSERT INTO public.hr_pay_component (code, name, kind, display_order) VALUES
  ('BASIC',  'Basic',            'EARNING',   1),
  ('DA',     'Dearness allowance', 'EARNING', 2),
  ('OTHERS', 'Other allowances', 'EARNING',   3),
  ('FIXED_DED', 'Fixed deduction', 'DEDUCTION', 9)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.hr_salary_revision (
  id            serial PRIMARY KEY,
  employee_id   int4 NOT NULL REFERENCES public.hr_employee(id),
  effective_from date NOT NULL,
  reason        varchar(200),
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_from)
);
CREATE TABLE IF NOT EXISTS public.hr_salary_revision_line (
  revision_id   int4 NOT NULL REFERENCES public.hr_salary_revision(id) ON DELETE CASCADE,
  component_id  int4 NOT NULL REFERENCES public.hr_pay_component(id),
  amount        numeric(10,2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (revision_id, component_id)
);

CREATE TABLE IF NOT EXISTS public.hr_leave_type (
  id            serial PRIMARY KEY,
  code          varchar(10) NOT NULL UNIQUE,
  name          varchar(40) NOT NULL,
  paid          boolean NOT NULL DEFAULT true,
  annual_days   numeric(5,1) NOT NULL DEFAULT 0,             -- entitlement per calendar year (unpaid: ignored)
  active        boolean NOT NULL DEFAULT true
);
INSERT INTO public.hr_leave_type (code, name, paid, annual_days) VALUES
  ('CL',  'Casual leave', true, 12),
  ('SL',  'Sick leave',   true, 6),
  ('LWP', 'Leave without pay', false, 0)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.hr_holiday (
  holiday_date  date PRIMARY KEY,
  name          varchar(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.hr_leave_request (
  id            serial PRIMARY KEY,
  employee_id   int4 NOT NULL REFERENCES public.hr_employee(id),
  leave_type_id int4 NOT NULL REFERENCES public.hr_leave_type(id),
  from_date     date NOT NULL,
  to_date       date NOT NULL,
  days          numeric(5,1) NOT NULL,
  half_day      boolean NOT NULL DEFAULT false,
  reason        varchar(200),
  status        varchar(10) NOT NULL DEFAULT 'PENDING',
  decided_by    int4,
  decided_on    timestamptz,
  decision_note varchar(200),
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_leave_status_chk CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT hr_leave_dates_chk  CHECK (to_date >= from_date)
);
-- one row per day of an approved leave: payroll and the attendance grid read this
CREATE TABLE IF NOT EXISTS public.hr_leave_day (
  request_id    int4 NOT NULL REFERENCES public.hr_leave_request(id) ON DELETE CASCADE,
  employee_id   int4 NOT NULL,
  leave_date    date NOT NULL,
  fraction      numeric(2,1) NOT NULL DEFAULT 1,
  paid          boolean NOT NULL,
  PRIMARY KEY (request_id, leave_date)
);
CREATE INDEX IF NOT EXISTS hr_leave_day_emp_idx ON public.hr_leave_day (employee_id, leave_date);

CREATE TABLE IF NOT EXISTS public.hr_attendance (
  id            serial PRIMARY KEY,
  employee_id   int4 NOT NULL REFERENCES public.hr_employee(id),
  att_date      date NOT NULL,
  status        varchar(10) NOT NULL,
  check_in      timestamptz,
  check_out     timestamptz,
  store_id      int4,
  source        varchar(10) NOT NULL DEFAULT 'MANUAL',       -- MANUAL now; APP when the staff app lands
  photo_path    varchar(200),                                -- selfie from the app (kept 60 days)
  verification_status varchar(12),
  note          varchar(200),
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, att_date),
  CONSTRAINT hr_att_status_chk CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY'))
);

CREATE TABLE IF NOT EXISTS public.hr_kpi_metric (
  id            serial PRIMARY KEY,
  name          varchar(60) NOT NULL,
  description   varchar(200),
  max_points    numeric(5,1) NOT NULL CHECK (max_points > 0),
  display_order int4 NOT NULL DEFAULT 10,
  active        boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.hr_kpi_band (
  id            serial PRIMARY KEY,
  min_percent   numeric(5,1) NOT NULL UNIQUE CHECK (min_percent >= 0 AND min_percent <= 100),
  label         varchar(30) NOT NULL,
  incentive_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (incentive_percent >= 0)   -- of the month's earnings
);
CREATE TABLE IF NOT EXISTS public.hr_kpi_review (
  id            serial PRIMARY KEY,
  employee_id   int4 NOT NULL REFERENCES public.hr_employee(id),
  period        char(7) NOT NULL,
  scores        jsonb NOT NULL,                              -- [{metric_id, name, max, points}]
  total_points  numeric(7,1) NOT NULL,
  max_points    numeric(7,1) NOT NULL,
  percent       numeric(5,1) NOT NULL,
  band_label    varchar(30),
  incentive_percent numeric(5,2) NOT NULL DEFAULT 0,
  note          varchar(200),
  scored_by     int4,
  scored_on     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period)
);

CREATE TABLE IF NOT EXISTS public.hr_payroll_run (
  id            serial PRIMARY KEY,
  period        char(7) NOT NULL UNIQUE,
  status        varchar(10) NOT NULL DEFAULT 'DRAFT',
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_net     numeric(12,2) NOT NULL DEFAULT 0,
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  approved_by   int4,
  approved_on   timestamptz,
  CONSTRAINT hr_payroll_status_chk CHECK (status IN ('DRAFT', 'APPROVED'))
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_line (
  id            serial PRIMARY KEY,
  run_id        int4 NOT NULL REFERENCES public.hr_payroll_run(id) ON DELETE CASCADE,
  employee_id   int4 NOT NULL REFERENCES public.hr_employee(id),
  payable_days  numeric(4,1) NOT NULL,                       -- of 30
  unpaid_days   numeric(4,1) NOT NULL DEFAULT 0,             -- absent, unpaid leave, half-days (generated; may be overridden)
  not_employed_days numeric(4,1) NOT NULL DEFAULT 0,         -- before joining / after leaving
  earnings      jsonb NOT NULL,                              -- [{code, name, full, paid}]
  deductions    jsonb NOT NULL,                              -- [{code, name, amount}]
  earnings_paid numeric(10,2) NOT NULL,
  fixed_deductions numeric(10,2) NOT NULL DEFAULT 0,
  extra_deduction numeric(10,2) NOT NULL DEFAULT 0,
  staff_credit_recovery numeric(10,2) NOT NULL DEFAULT 0,
  kpi_incentive numeric(10,2) NOT NULL DEFAULT 0,
  adjustment    numeric(10,2) NOT NULL DEFAULT 0,
  adjustment_note varchar(200),
  net           numeric(10,2) NOT NULL,
  UNIQUE (run_id, employee_id)
);

-- the Business Head manages it all; the page is /secure/hr
UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"hr","path":"/secure/hr","policies":[{"action":"view"},{"action":"manage"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "hr")');
