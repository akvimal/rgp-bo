-- 036_rollback.sql

delete from public.app_setting where setting_key in
  ('notification.daily.enabled', 'notification.daily.time', 'notification.telegram.consolidated_chat_id');
drop table if exists public.notification_log;
alter table public.stores drop column if exists telegram_digest_enabled, drop column if exists telegram_chat_id;
