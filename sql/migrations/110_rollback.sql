-- Rollback 110: remove the per-business settings table.
DROP TABLE IF EXISTS public.config_override;
