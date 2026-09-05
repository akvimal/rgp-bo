-- 034_rollback.sql

alter table public.store_shifts drop column if exists closing_checklist;
alter table public.store_shifts drop column if exists opening_checklist;
