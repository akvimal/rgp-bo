-- 074: store profile (OPERATING_MODES step 1). How a store runs its tills.
--   shift_mode      time  = one shared till, closed at handover; staff = each person has a drawer and closes their own
--   till            shared | per_person; NULL follows the shift mode
--   accountable_role auto = the store head if the store has one, else the business head
--   operator_required ask who is serving on each bill
--   operator_hold_minutes how long the counter keeps the last operator (0 = ask on every bill)
-- Existing stores keep today's behaviour: time-based, one shared till.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS shift_mode varchar(10) NOT NULL DEFAULT 'time';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS till varchar(12);
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS accountable_role varchar(15) NOT NULL DEFAULT 'auto';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS operator_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS operator_hold_minutes integer NOT NULL DEFAULT 60;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_shift_mode_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_shift_mode_chk CHECK (shift_mode IN ('time', 'staff'));
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_till_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_till_chk CHECK (till IS NULL OR till IN ('shared', 'per_person'));
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_accountable_role_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_accountable_role_chk CHECK (accountable_role IN ('auto', 'store_head', 'business_head'));
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_operator_hold_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_operator_hold_chk CHECK (operator_hold_minutes BETWEEN 0 AND 1440);

-- who answers for a cash difference when the shift closed (store head, else business head)
ALTER TABLE public.store_shifts ADD COLUMN IF NOT EXISTS accountable_user_id integer REFERENCES public.app_user(id);

-- staff-based stores: one open shift per person per store (time-based stores are held to one per store by the API)
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_shifts_open_person
  ON public.store_shifts (store_id, assigned_user_id)
  WHERE status = 'OPEN' AND assigned_user_id IS NOT NULL;
