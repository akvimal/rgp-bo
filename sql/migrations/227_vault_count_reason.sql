-- 227: a vault count that differs from the books now carries the reason for the difference (like a shift's cash variance reason), and records the last
-- end-of-day shift that had closed when it was made (after_shift_id), so "was the vault counted after the day closed" is answered by order, not by comparing
-- clocks. The count itself and its variance are kept as before. Rollback: 227_rollback.sql.
ALTER TABLE public.store_vault_counts ADD COLUMN IF NOT EXISTS variance_reason varchar(300) NULL;
ALTER TABLE public.store_vault_counts ADD COLUMN IF NOT EXISTS after_shift_id   int4 NULL;
