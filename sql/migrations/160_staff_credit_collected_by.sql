-- 160: a bill on staff credit can say who collected the medicines (a family member of the staff member, by name and relation).
-- The credit, the cap and the salary recovery all stay with the staff member; this only records who the goods went to.
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS staff_credit_for varchar(80);
