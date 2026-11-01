-- 140: staff alerts on Telegram, through an outbox.
--   user_channel        : a staff member's own Telegram chat (linked by pressing Start on a link made in the app), with when to be disturbed
--   channel_link_token  : the one-time link behind "Connect Telegram" (only a hash is kept; it expires)
--   message_outbox      : every message the app sends outside itself: what, to whom, and whether it went. A message is written first and sent by a worker,
--                         so a failure is retried and nothing is lost or sent twice. Built for any channel; Telegram is the first.
CREATE TABLE IF NOT EXISTS public.user_channel (
    id serial4 PRIMARY KEY,
    user_id int4 NOT NULL REFERENCES public.app_user(id),
    channel varchar(12) NOT NULL,
    chat_id varchar(40) NOT NULL,
    handle varchar(80) NULL,
    status varchar(10) NOT NULL DEFAULT 'ACTIVE',
    min_severity varchar(10) NOT NULL DEFAULT 'warning',
    quiet_from varchar(5) NULL DEFAULT '22:00',
    quiet_to varchar(5) NULL DEFAULT '07:00',
    linked_on timestamptz NOT NULL DEFAULT now(),
    stopped_on timestamptz NULL,
    last_sent_on timestamptz NULL,
    CONSTRAINT user_channel_status_chk CHECK (status IN ('ACTIVE', 'STOPPED', 'BLOCKED')),
    CONSTRAINT user_channel_severity_chk CHECK (min_severity IN ('info', 'warning', 'critical'))
);
CREATE UNIQUE INDEX IF NOT EXISTS user_channel_user_uq ON public.user_channel (user_id, channel);
CREATE UNIQUE INDEX IF NOT EXISTS user_channel_chat_uq ON public.user_channel (channel, chat_id);

CREATE TABLE IF NOT EXISTS public.channel_link_token (
    token_hash varchar(64) PRIMARY KEY,
    user_id int4 NOT NULL REFERENCES public.app_user(id),
    channel varchar(12) NOT NULL,
    expires_on timestamptz NOT NULL,
    used_on timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.message_outbox (
    id bigserial PRIMARY KEY,
    business_id int4 NULL,
    channel varchar(12) NOT NULL,
    recipient_user_id int4 NOT NULL,
    chat_id varchar(40) NOT NULL,
    kind varchar(20) NOT NULL DEFAULT 'ALERT',
    ref_type varchar(20) NULL,
    ref_id int8 NULL,
    severity varchar(10) NULL,
    title varchar(200) NULL,
    body text NOT NULL,
    link varchar(200) NULL,
    status varchar(10) NOT NULL DEFAULT 'PENDING',
    attempts int4 NOT NULL DEFAULT 0,
    send_after timestamptz NOT NULL DEFAULT now(),
    last_error varchar(300) NULL,
    provider_id varchar(60) NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    sent_on timestamptz NULL,
    CONSTRAINT message_outbox_status_chk CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'))
);
-- the same alert never goes twice to the same person on the same channel
CREATE UNIQUE INDEX IF NOT EXISTS message_outbox_ref_uq ON public.message_outbox (channel, recipient_user_id, kind, ref_type, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_outbox_due_idx ON public.message_outbox (send_after) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS message_outbox_recent_idx ON public.message_outbox (business_id, created_on DESC);

-- the owner's switch for sending alerts out of the app (on by default; it only works once the server has a bot)
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'alerts', 'alerts_telegram', 'on', 'on = alerts are also sent to the Telegram of staff who connected it. off = in-app only.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'alerts_telegram');
