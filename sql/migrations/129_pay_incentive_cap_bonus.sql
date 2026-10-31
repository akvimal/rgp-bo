-- 129: Variable pay on the payroll.
--  * incentive_cap: the most a person can earn as KPI incentive in a month. Set on a job role (the usual), and on a person to
--    override it. No cap means the KPI band decides alone.
--  * hr_bonus_item: a bonus given in a pay month (a festival bonus to everyone, a performance bonus to one person). Payroll adds
--    the month's items to the pay; an approved month is locked.
--  * hr_payroll_line keeps what the KPI bands gave before the cap, the cap that applied, and the bonus with its items, so a pay
--    slip can say why an incentive is what it is.
ALTER TABLE public.hr_position ADD COLUMN IF NOT EXISTS incentive_cap numeric(10,2) CHECK (incentive_cap IS NULL OR incentive_cap >= 0);
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS incentive_cap numeric(10,2) CHECK (incentive_cap IS NULL OR incentive_cap >= 0);

CREATE TABLE IF NOT EXISTS public.hr_bonus_item (
  id            serial PRIMARY KEY,
  employee_id   int4 NOT NULL REFERENCES public.hr_employee(id),
  period        char(7) NOT NULL,                              -- the pay month it is paid in, YYYY-MM
  kind          varchar(12) NOT NULL,
  name          varchar(60) NOT NULL,                          -- "Diwali 2026"
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  basis         varchar(10),                                   -- how it was worked out, for the record: FIXED / BASIC_PCT / GROSS_PCT
  note          varchar(200),
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_bonus_item_kind_chk CHECK (kind IN ('FESTIVAL', 'PERFORMANCE', 'REFERRAL', 'OTHER')),
  CONSTRAINT hr_bonus_item_period_chk CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  UNIQUE (employee_id, period, name)
);
CREATE INDEX IF NOT EXISTS hr_bonus_item_period_idx ON public.hr_bonus_item (period);

ALTER TABLE public.hr_payroll_line
  ADD COLUMN IF NOT EXISTS incentive_uncapped numeric(10,2),
  ADD COLUMN IF NOT EXISTS incentive_cap numeric(10,2),
  ADD COLUMN IF NOT EXISTS bonus numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_items jsonb NOT NULL DEFAULT '[]'::jsonb;   -- [{id, name, kind, amount}]
