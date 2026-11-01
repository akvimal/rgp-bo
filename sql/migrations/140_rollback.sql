-- rollback of 140
DROP TABLE IF EXISTS public.message_outbox;
DROP TABLE IF EXISTS public.channel_link_token;
DROP TABLE IF EXISTS public.user_channel;
DELETE FROM public.app_setting WHERE setting_key IN ('alerts_telegram', 'telegram.offset');
