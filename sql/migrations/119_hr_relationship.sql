-- 119: How a person relates to the business, and whether payroll pays them.
--  * hr_employee.relationship: EMPLOYEE (default), OWNER (proprietor or partner) or DIRECTOR (limited company).
--  * hr_employee.on_payroll: payroll and KPI incentive skip anyone who is not on payroll. An owner or partner is never on payroll;
--    a director is only when the owner says the company pays them a salary. Everyone that exists today stays an employee on payroll.
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS relationship varchar(10) NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS on_payroll boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_employee_relationship_chk') THEN
    ALTER TABLE public.hr_employee ADD CONSTRAINT hr_employee_relationship_chk
      CHECK (relationship IN ('EMPLOYEE', 'OWNER', 'DIRECTOR') AND (relationship <> 'OWNER' OR on_payroll = false) AND (relationship <> 'EMPLOYEE' OR on_payroll = true));
  END IF;
END $$;
