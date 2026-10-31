-- rollback of 129: drops the incentive caps and the bonus items; the payroll lines lose their bonus figures
ALTER TABLE public.hr_payroll_line DROP COLUMN IF EXISTS bonus_items, DROP COLUMN IF EXISTS bonus, DROP COLUMN IF EXISTS incentive_cap, DROP COLUMN IF EXISTS incentive_uncapped;
DROP TABLE IF EXISTS public.hr_bonus_item;
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS incentive_cap;
ALTER TABLE public.hr_position DROP COLUMN IF EXISTS incentive_cap;
