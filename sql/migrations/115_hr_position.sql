-- 115: Job roles with a pay structure (HR > Setup).
--  * hr_position: a job role of the business (Pharmacist, Cashier, ...), separate from a login's role.
--  * hr_position_line: the standard amount of each pay component for that job role. It is a template: a salary revision starts from it,
--    and changing it later never changes a salary already given.
--  * hr_employee.position_id: the job role a staff member holds (optional).
CREATE TABLE IF NOT EXISTS public.hr_position (
  id            serial PRIMARY KEY,
  name          varchar(60) NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT true,
  created_by    int4,
  created_on    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_position_line (
  position_id   int4 NOT NULL REFERENCES public.hr_position(id) ON DELETE CASCADE,
  component_id  int4 NOT NULL REFERENCES public.hr_pay_component(id),
  amount        numeric(10,2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (position_id, component_id)
);
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS position_id int4 REFERENCES public.hr_position(id);
