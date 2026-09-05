-- 033_cash_expense_category.sql
-- WS-2 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: structured store expense tracking.
-- A structured expense IS an EXPENSE-category store_cash_accounts row (cash-variance math is
-- untouched) - this just adds a category + an optional receipt path (no `files` table exists in
-- this codebase to key a real FK against - the files module is disk-storage only, so this mirrors
-- that existing plain-path convention rather than inventing a new one).

alter table public.store_cash_accounts
  add column if not exists expense_category varchar(30),
  add column if not exists receipt_path varchar(255);
