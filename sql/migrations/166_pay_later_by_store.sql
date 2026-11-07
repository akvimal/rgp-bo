-- 166: pay later (a customer owes part of a bill) can be switched off for a store (stores.pay_later_allowed, default true = as before).
--   Separate from staff credit (165). A store that is off hides the Pay later button at its till and refuses a bill with an amount left to pay later.
--   Dues already recorded, limits and collecting them are untouched.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pay_later_allowed boolean NOT NULL DEFAULT true;
