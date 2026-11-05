-- 156: expense categories get a level (where the cost is paid) and a group (the kind of cost).
--   level: STORE = always booked to a store; BUSINESS = booked at business level (the Business Head); BOTH = either.
--   cost_group: Premises, People, Operations, Technology, Compliance and finance, Marketing, Other (reports roll up by it).
-- Repeating expenses can repeat every 1, 3, 6 or 12 months (a yearly subscription), not only monthly.
-- Existing expenses and repeating templates are not touched; the level is checked when an expense is saved.
ALTER TABLE public.expense_category ADD COLUMN IF NOT EXISTS level varchar(8) NOT NULL DEFAULT 'BOTH';
ALTER TABLE public.expense_category ADD COLUMN IF NOT EXISTS cost_group varchar(30) NOT NULL DEFAULT 'Other';
ALTER TABLE public.expense_category DROP CONSTRAINT IF EXISTS expense_category_level_chk;
ALTER TABLE public.expense_category ADD CONSTRAINT expense_category_level_chk CHECK (level IN ('STORE', 'BUSINESS', 'BOTH'));

-- starting values for the categories the app has always had; anything a business added stays Both / Other until they set it
UPDATE public.expense_category SET cost_group = 'Premises' WHERE name IN ('Rent', 'Electricity', 'Water', 'Cleaning', 'Repairs and maintenance') AND cost_group = 'Other';
UPDATE public.expense_category SET cost_group = 'People' WHERE name = 'Salaries' AND cost_group = 'Other';
UPDATE public.expense_category SET cost_group = 'Operations' WHERE name IN ('Transport and courier', 'Stationery and printing') AND cost_group = 'Other';
UPDATE public.expense_category SET cost_group = 'Technology' WHERE name = 'Internet and phone' AND cost_group = 'Other';
UPDATE public.expense_category SET cost_group = 'Compliance and finance' WHERE name IN ('Licences and fees', 'Professional fees', 'Insurance') AND cost_group = 'Other';
UPDATE public.expense_category SET cost_group = 'Marketing' WHERE name = 'Marketing' AND cost_group = 'Other';
-- paid at the store, by the Store Head: always booked to a store
UPDATE public.expense_category SET level = 'STORE' WHERE name IN ('Water', 'Cleaning', 'Repairs and maintenance') AND level = 'BOTH';
-- head-office costs
UPDATE public.expense_category SET level = 'BUSINESS' WHERE name IN ('Professional fees', 'Insurance') AND level = 'BOTH';

-- software and subscriptions: a business pays them at head office, or a store has its own licence
INSERT INTO public.expense_category (name, display_order, level, cost_group) VALUES
  ('Software and subscriptions', 14, 'BOTH', 'Technology'),
  ('Cloud and hosting', 15, 'BUSINESS', 'Technology'),
  ('IT support and AMC', 16, 'BOTH', 'Technology')
ON CONFLICT (name) DO NOTHING;

-- a repeating expense can come every 1, 3, 6 or 12 months, counted from its first month
ALTER TABLE public.expense_recurring ADD COLUMN IF NOT EXISTS every_months int4 NOT NULL DEFAULT 1;
ALTER TABLE public.expense_recurring DROP CONSTRAINT IF EXISTS expense_recurring_every_chk;
ALTER TABLE public.expense_recurring ADD CONSTRAINT expense_recurring_every_chk CHECK (every_months IN (1, 3, 6, 12));
