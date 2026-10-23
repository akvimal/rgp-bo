-- 081: a pharmacist's registration on the staff record (number, council, valid to), so a shop can see who may dispense and when it lapses.
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS pharmacist_reg_no varchar(30);
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS pharmacist_council varchar(60);
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS pharmacist_valid_to date;
