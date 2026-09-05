-- 030_rollback.sql

alter table public.product drop column if exists bin_location;
