-- 033_rollback.sql

alter table public.store_cash_accounts drop column if exists receipt_path;
alter table public.store_cash_accounts drop column if exists expense_category;
