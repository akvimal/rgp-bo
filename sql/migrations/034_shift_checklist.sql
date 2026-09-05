-- 034_shift_checklist.sql
-- WS-7 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md: an opening/closing checklist for the
-- cashier, same jsonb-array shape as the existing denomination columns.

alter table public.store_shifts
  add column if not exists opening_checklist jsonb,
  add column if not exists closing_checklist jsonb;
