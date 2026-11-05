-- rollback of 156 (the software categories stay: they are ordinary rows)
ALTER TABLE public.expense_recurring DROP CONSTRAINT IF EXISTS expense_recurring_every_chk;
ALTER TABLE public.expense_recurring DROP COLUMN IF EXISTS every_months;
ALTER TABLE public.expense_category DROP CONSTRAINT IF EXISTS expense_category_level_chk;
ALTER TABLE public.expense_category DROP COLUMN IF EXISTS level, DROP COLUMN IF EXISTS cost_group;
