-- 153: registered store PCs. A manager registers the PC they are sitting at; a PC that is registered can skip the authenticator step
-- (the password is still asked) and, when a Counter login is linked to it, signs that login in on its own.
--   store_device.token_hash      : sha256 of the secret kept in the PC's browser (the secret itself is never stored)
--   store_device.counter_user_id : the Counter login that signs in automatically on this PC (null = none)
--   store_device.active          : false once revoked; a revoked PC's sessions stop at the next request
-- The setting trusted_device_mfa says who may skip the second step on a registered PC: off | counter (Counter logins only) | all (everyone but owners).
CREATE TABLE IF NOT EXISTS public.store_device (
    id serial4 NOT NULL,
    store_id int4 NOT NULL REFERENCES public.stores(id),
    name varchar(120) NOT NULL,
    token_hash char(64) NOT NULL,
    counter_user_id int4 NULL REFERENCES public.app_user(id),
    active bool NOT NULL DEFAULT true,
    registered_by int4 NULL,
    registered_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen timestamptz NULL,
    last_ip varchar(64) NULL,
    revoked_by int4 NULL,
    revoked_on timestamptz NULL,
    CONSTRAINT store_device_pk PRIMARY KEY (id),
    CONSTRAINT store_device_token_un UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS store_device_store_idx ON public.store_device (store_id) WHERE active;

INSERT INTO public.app_setting (category, setting_key, setting_value, description)
VALUES ('auth', 'trusted_device_mfa', 'counter', 'Who may skip the authenticator step on a registered store PC: off, counter (Counter logins only) or all (everyone except owners)')
ON CONFLICT (setting_key) DO NOTHING;
