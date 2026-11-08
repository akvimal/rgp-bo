ALTER TABLE public.hr_kpi_review DROP COLUMN IF EXISTS incentive_amount;
ALTER TABLE public.hr_kpi_band DROP CONSTRAINT IF EXISTS hr_kpi_band_amount_chk;
ALTER TABLE public.hr_kpi_band DROP COLUMN IF EXISTS incentive_amount;
ALTER TABLE public.hr_position DROP COLUMN IF EXISTS purpose, DROP COLUMN IF EXISTS responsibilities, DROP COLUMN IF EXISTS jd_approved_by, DROP COLUMN IF EXISTS jd_approved_on;
DELETE FROM public.app_setting WHERE setting_key = 'hr.incentive_ceiling_pct';
