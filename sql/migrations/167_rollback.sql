-- fails (by design) if a FLOAT_TO_DRAWER movement exists: those rows are part of the vault balance and must not be dropped silently
DROP INDEX IF EXISTS public.svm_one_float_per_shift_uq;
ALTER TABLE public.store_vault_movements DROP CONSTRAINT IF EXISTS svm_direction_type_chk;
ALTER TABLE public.store_vault_movements DROP CONSTRAINT IF EXISTS svm_type_chk;
ALTER TABLE public.store_vault_movements ADD CONSTRAINT svm_type_chk CHECK (move_type IN ('OPENING', 'DROP_IN', 'BANK_DEPOSIT_OUT', 'CHANGE_TO_DRAWER', 'ADJUSTMENT'));
ALTER TABLE public.store_vault_movements ADD CONSTRAINT svm_direction_type_chk CHECK (
  (move_type IN ('OPENING', 'DROP_IN') AND direction = 'IN')
  OR (move_type IN ('BANK_DEPOSIT_OUT', 'CHANGE_TO_DRAWER') AND direction = 'OUT')
  OR move_type = 'ADJUSTMENT');
ALTER TABLE public.stores DROP COLUMN IF EXISTS drawer_emptied_at_close;
