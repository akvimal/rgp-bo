-- 222: the bank deposit slip (challan) photo or PDF kept with a vault deposit. It is entered with the reference number when cash is banked from the vault, or added
-- afterwards when the slip arrives, and it follows the deposit into the cash book row (store_cash_accounts.receipt_path already exists for expenses).
-- Rollback: 222_rollback.sql.
ALTER TABLE public.store_vault_movements ADD COLUMN IF NOT EXISTS receipt_path varchar(300) NULL;
