-- 169: leave type rules.
--   accrual_mode          YEARLY (the whole year's days from the start, as before) or MONTHLY (a twelfth on the first of each month from the month of
--                         joining, using the 15th rule; the balance starts again each 1 January and unused days lapse)
--   wait_months           the leave can be taken only this many months after the date of joining (0 = no wait)
--   max_consecutive       the most days of this type that may be taken together (NULL = no limit)
--   stretch_counts_offs   weekly offs and holidays between leave days count towards "together" (Friday and Monday with a weekend between = 4 days)
--   hr_leave_request.override_reason  why a manager allowed more days together than the limit
--   advice_from_day / advice_to_day / advice_avoid_weekdays / advice_roles : ADVISED days (not a refusal): the leave is taken between these days of the
--                         month and not on these weekdays (0 = Sunday ... 6 = Saturday), for these login roles (empty = everyone the type applies to).
--                         A request outside them is still recorded, with a note the approver sees (hr_leave_request.policy_note).
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS accrual_mode varchar(8) NOT NULL DEFAULT 'YEARLY';
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS wait_months int4 NOT NULL DEFAULT 0;
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS max_consecutive int4 NULL;
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS stretch_counts_offs boolean NOT NULL DEFAULT true;
ALTER TABLE public.hr_leave_type DROP CONSTRAINT IF EXISTS hr_leave_type_policy_chk;
ALTER TABLE public.hr_leave_type ADD CONSTRAINT hr_leave_type_policy_chk
  CHECK (accrual_mode IN ('YEARLY', 'MONTHLY') AND wait_months BETWEEN 0 AND 60 AND (max_consecutive IS NULL OR max_consecutive BETWEEN 1 AND 60));
ALTER TABLE public.hr_leave_request ADD COLUMN IF NOT EXISTS override_reason varchar(200) NULL;

-- the usual casual and sick leave follow the policy: they build up monthly, and casual leave is at most 2 days together.
-- (Change either on Staff and HR > Setup > Leave types. Any other leave type stays as it was.)
UPDATE public.hr_leave_type SET accrual_mode = 'MONTHLY', max_consecutive = 2 WHERE code = 'CL';
UPDATE public.hr_leave_type SET accrual_mode = 'MONTHLY' WHERE code = 'SL';

ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS advice_from_day int4 NULL;
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS advice_to_day int4 NULL;
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS advice_avoid_weekdays int4[] NULL;
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS advice_roles text[] NULL;
ALTER TABLE public.hr_leave_type DROP CONSTRAINT IF EXISTS hr_leave_type_advice_chk;
ALTER TABLE public.hr_leave_type ADD CONSTRAINT hr_leave_type_advice_chk
  CHECK ((advice_from_day IS NULL AND advice_to_day IS NULL) OR (advice_from_day BETWEEN 1 AND 31 AND advice_to_day BETWEEN advice_from_day AND 31));
ALTER TABLE public.hr_leave_request ADD COLUMN IF NOT EXISTS policy_note varchar(300) NULL;

-- store staff who bill at the counter: casual leave is advised between the 11th and the 25th, and not on a Saturday or Sunday
UPDATE public.hr_leave_type SET advice_from_day = 11, advice_to_day = 25, advice_avoid_weekdays = ARRAY[0, 6], advice_roles = ARRAY['Sales Staff', 'Counter']
 WHERE code = 'CL';
