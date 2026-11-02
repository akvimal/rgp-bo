-- 145: a store vault that holds cash, by denomination, until it is banked. Separate from the shift drawer.
--   stores.vault_enabled             : the store keeps a vault (off for stores that do not; nothing else changes for them)
--   stores.float_amount / float_denominations : the fixed float a drawer starts each shift with, and the note mix preferred for it
--   stores.vault_drop_confirm_limit  : a drop to the vault above this amount waits for a second person; 0 means no confirmation needed
--   store_vault_movements : every movement in or out of the vault. The vault balance is derived from these rows plus the counts below.
--   store_vault_counts    : periodic counts of the vault with the expected figure and the variance, kept apart from shift variances
--   store_cash_accounts.holder / vault_movement_id : which holder a cash-book row belongs to, and the vault movement behind it
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS vault_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS float_amount double precision NOT NULL DEFAULT 0;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS float_denominations jsonb NULL;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS vault_drop_confirm_limit double precision NOT NULL DEFAULT 0;
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_float_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_float_chk CHECK (float_amount >= 0 AND vault_drop_confirm_limit >= 0);

CREATE TABLE IF NOT EXISTS public.store_vault_movements (
    id bigserial PRIMARY KEY,
    store_id int4 NOT NULL REFERENCES public.stores(id),
    shift_id int4 NULL REFERENCES public.store_shifts(id),
    move_type varchar(20) NOT NULL,
    direction varchar(3) NOT NULL,
    amount double precision NOT NULL,
    denominations jsonb NOT NULL DEFAULT '[]'::jsonb,
    status varchar(10) NOT NULL DEFAULT 'CONFIRMED',
    actor_id int4 NOT NULL REFERENCES public.app_user(id),
    confirmed_by int4 NULL REFERENCES public.app_user(id),
    confirmed_on timestamptz NULL,
    reference_no varchar(40) NULL,
    reason varchar(200) NULL,
    notes text NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT svm_type_chk CHECK (move_type IN ('OPENING', 'DROP_IN', 'BANK_DEPOSIT_OUT', 'CHANGE_TO_DRAWER', 'ADJUSTMENT')),
    CONSTRAINT svm_direction_chk CHECK (direction IN ('IN', 'OUT')),
    CONSTRAINT svm_status_chk CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
    CONSTRAINT svm_amount_chk CHECK (amount > 0),
    CONSTRAINT svm_direction_type_chk CHECK (
        (move_type IN ('OPENING', 'DROP_IN') AND direction = 'IN')
        OR (move_type IN ('BANK_DEPOSIT_OUT', 'CHANGE_TO_DRAWER') AND direction = 'OUT')
        OR move_type = 'ADJUSTMENT'),
    CONSTRAINT svm_second_person_chk CHECK (confirmed_by IS NULL OR confirmed_by <> actor_id),
    CONSTRAINT svm_adjust_reason_chk CHECK (move_type <> 'ADJUSTMENT' OR coalesce(btrim(reason), '') <> '')
);
CREATE INDEX IF NOT EXISTS svm_store_created_idx ON public.store_vault_movements (store_id, created_on DESC);
CREATE INDEX IF NOT EXISTS svm_shift_idx ON public.store_vault_movements (shift_id) WHERE shift_id IS NOT NULL;
-- one drop per shift keeps a retried close from putting the same cash into the vault twice
CREATE UNIQUE INDEX IF NOT EXISTS svm_one_drop_per_shift_uq ON public.store_vault_movements (shift_id)
    WHERE move_type = 'DROP_IN' AND status <> 'REJECTED';

CREATE TABLE IF NOT EXISTS public.store_vault_counts (
    id bigserial PRIMARY KEY,
    store_id int4 NOT NULL REFERENCES public.stores(id),
    expected double precision NOT NULL,
    counted double precision NOT NULL,
    variance double precision NOT NULL,
    denominations jsonb NOT NULL DEFAULT '[]'::jsonb,
    counted_by int4 NOT NULL REFERENCES public.app_user(id),
    notes text NULL,
    counted_on timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS svc_store_counted_idx ON public.store_vault_counts (store_id, counted_on DESC);

ALTER TABLE public.store_cash_accounts ADD COLUMN IF NOT EXISTS holder varchar(6) NOT NULL DEFAULT 'DRAWER';
ALTER TABLE public.store_cash_accounts ADD COLUMN IF NOT EXISTS vault_movement_id int8 NULL;
ALTER TABLE public.store_cash_accounts DROP CONSTRAINT IF EXISTS sca_holder_chk;
ALTER TABLE public.store_cash_accounts ADD CONSTRAINT sca_holder_chk CHECK (holder IN ('DRAWER', 'VAULT'));
ALTER TABLE public.store_cash_accounts DROP CONSTRAINT IF EXISTS sca_vault_movement_fk;
ALTER TABLE public.store_cash_accounts ADD CONSTRAINT sca_vault_movement_fk FOREIGN KEY (vault_movement_id) REFERENCES public.store_vault_movements(id);
