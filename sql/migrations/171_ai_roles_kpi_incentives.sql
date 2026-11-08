-- AI-assisted job roles, KPIs and incentives (all drafted by the assistant, used only once the Business Head approves).
--  * hr_position: purpose and responsibilities (the job description), approved by a person
--  * hr_kpi_band.incentive_amount: a fixed rupee amount for a band (null = the band pays its percent of earnings, as before)
--  * hr_kpi_review.incentive_amount: the amount frozen with the review, so payroll pays what was earned when the month was finalised
ALTER TABLE public.hr_position ADD COLUMN IF NOT EXISTS purpose varchar(300);
ALTER TABLE public.hr_position ADD COLUMN IF NOT EXISTS responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.hr_position ADD COLUMN IF NOT EXISTS jd_approved_by int4;
ALTER TABLE public.hr_position ADD COLUMN IF NOT EXISTS jd_approved_on timestamptz;

ALTER TABLE public.hr_kpi_band ADD COLUMN IF NOT EXISTS incentive_amount numeric(10,2);
ALTER TABLE public.hr_kpi_band DROP CONSTRAINT IF EXISTS hr_kpi_band_amount_chk;
ALTER TABLE public.hr_kpi_band ADD CONSTRAINT hr_kpi_band_amount_chk CHECK (incentive_amount IS NULL OR incentive_amount >= 0);
ALTER TABLE public.hr_kpi_review ADD COLUMN IF NOT EXISTS incentive_amount numeric(10,2);
