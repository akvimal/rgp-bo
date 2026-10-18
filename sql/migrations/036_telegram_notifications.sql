-- 036_telegram_notifications.sql
-- Telegram digest notifications (daily first; weekly/monthly reuse the same tables).
-- Per-store chat routing lives on stores; the optional consolidated chat and the send time live in
-- app_setting (notification.telegram.consolidated_chat_id, notification.daily.time).
-- notification_log doubles as the idempotency guard: one row per (kind, period_key, scope).

alter table public.stores
  add column if not exists telegram_chat_id varchar(40) null,
  add column if not exists telegram_digest_enabled boolean not null default true;

create table if not exists public.notification_log (
    id serial4 not null,
    kind varchar(20) not null,          -- DAILY | WEEKLY | MONTHLY
    period_key varchar(20) not null,    -- e.g. 2026-10-18 for a daily digest
    scope varchar(30) not null,         -- 'store:<id>' or 'all'
    status varchar(10) not null,        -- SENT | FAILED
    error varchar(400) null,
    attempts int4 not null default 1,
    sent_on timestamptz not null default current_timestamp,
    constraint notification_log_pk primary key (id),
    constraint notification_log_un unique (kind, period_key, scope)
);

insert into public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
values
  ('notification', 'notification.daily.enabled', 'true', 'Send the daily Telegram digest', true, false, 1, 1),
  ('notification', 'notification.daily.time', '22:30', 'Daily digest send time (HH:mm, Asia/Kolkata)', true, false, 1, 1),
  ('notification', 'notification.telegram.consolidated_chat_id', '', 'Optional chat for the all-stores digest incl. purchases', true, false, 1, 1)
on conflict (setting_key) do nothing;
