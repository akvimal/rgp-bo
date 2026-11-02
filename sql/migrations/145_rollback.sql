-- rollback of 145 (drops all vault data)
ALTER TABLE public.store_cash_accounts DROP CONSTRAINT IF EXISTS sca_vault_movement_fk;
ALTER TABLE public.store_cash_accounts DROP CONSTRAINT IF EXISTS sca_holder_chk;
ALTER TABLE public.store_cash_accounts DROP COLUMN IF EXISTS vault_movement_id;
ALTER TABLE public.store_cash_accounts DROP COLUMN IF EXISTS holder;
DROP TABLE IF EXISTS public.store_vault_counts;
DROP TABLE IF EXISTS public.store_vault_movements;
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_float_chk;
ALTER TABLE public.stores DROP COLUMN IF EXISTS vault_drop_confirm_limit;
ALTER TABLE public.stores DROP COLUMN IF EXISTS float_denominations;
ALTER TABLE public.stores DROP COLUMN IF EXISTS float_amount;
ALTER TABLE public.stores DROP COLUMN IF EXISTS vault_enabled;
