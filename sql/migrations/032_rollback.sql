-- 032_rollback.sql

alter table public.store_cash_accounts drop column if exists reference_no;
