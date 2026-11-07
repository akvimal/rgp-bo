-- 167: the opening float of a shift can be taken from the store's vault (a manager picks the notes and coins; they leave the vault and become the
--   shift's opening cash). A new vault movement type FLOAT_TO_DRAWER (out of the vault, tied to the shift, once per shift), and a store setting
--   stores.drawer_emptied_at_close: when on, the end-of-day close puts the WHOLE drawer count in the vault (no float stays behind).
ALTER TABLE public.store_vault_movements DROP CONSTRAINT IF EXISTS svm_type_chk;
ALTER TABLE public.store_vault_movements ADD CONSTRAINT svm_type_chk
  CHECK (move_type IN ('OPENING', 'DROP_IN', 'BANK_DEPOSIT_OUT', 'CHANGE_TO_DRAWER', 'FLOAT_TO_DRAWER', 'ADJUSTMENT'));
ALTER TABLE public.store_vault_movements DROP CONSTRAINT IF EXISTS svm_direction_type_chk;
ALTER TABLE public.store_vault_movements ADD CONSTRAINT svm_direction_type_chk CHECK (
  (move_type IN ('OPENING', 'DROP_IN') AND direction = 'IN')
  OR (move_type IN ('BANK_DEPOSIT_OUT', 'CHANGE_TO_DRAWER', 'FLOAT_TO_DRAWER') AND direction = 'OUT')
  OR move_type = 'ADJUSTMENT');
CREATE UNIQUE INDEX IF NOT EXISTS svm_one_float_per_shift_uq ON public.store_vault_movements (shift_id)
  WHERE move_type = 'FLOAT_TO_DRAWER' AND status <> 'REJECTED';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS drawer_emptied_at_close boolean NOT NULL DEFAULT false;
