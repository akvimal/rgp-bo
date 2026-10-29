-- rollback of 105_returns_switch.sql
ALTER TABLE public.stores DROP COLUMN IF EXISTS returns_allowed;
