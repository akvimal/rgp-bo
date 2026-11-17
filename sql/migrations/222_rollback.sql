-- Rollback of 222: the slip is no longer kept with a vault movement (the files stay on disk; a cash book row keeps its own copy of the path).
ALTER TABLE public.store_vault_movements DROP COLUMN IF EXISTS receipt_path;
