-- 078: the staffing preset a business chose in the setup wizard (OPERATING_MODES step 5). It only records the choice; the settings it set stay changeable one by one.
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS staffing_preset varchar(20);
ALTER TABLE public.business DROP CONSTRAINT IF EXISTS business_staffing_preset_chk;
ALTER TABLE public.business ADD CONSTRAINT business_staffing_preset_chk CHECK (staffing_preset IS NULL OR staffing_preset IN ('solo', 'owner_and_staff', 'manager_and_staff', 'multi_store'));
