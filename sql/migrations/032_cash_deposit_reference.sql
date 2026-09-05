-- 032_cash_deposit_reference.sql
-- WS-9 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: a deposit-slip / UTR reference number
-- for BANK_DEPOSIT cash-ledger rows, for reconciling against the actual bank statement.

alter table public.store_cash_accounts
  add column if not exists reference_no varchar(40);
