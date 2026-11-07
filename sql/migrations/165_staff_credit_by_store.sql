-- 165: staff credit can be switched off for a store (stores.staff_credit_allowed, default true = as before).
--   A store that is off hides the Staff credit button at its till and refuses a bill on staff credit. Credit already given, caps and salary recovery are untouched.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS staff_credit_allowed boolean NOT NULL DEFAULT true;
