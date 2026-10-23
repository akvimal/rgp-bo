-- 084: alerts. A rule says what to watch (a kind with its numbers), for whom and how loudly; the engine turns what it finds into
-- notifications that stay open until the cause is fixed. Each person has their own read / dismissed / snoozed marks and a language.
CREATE TABLE IF NOT EXISTS public.alert_rule (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL REFERENCES public.business(id),
    store_id int4 NULL REFERENCES public.stores(id),
    kind varchar(40) NOT NULL,
    name varchar(120) NOT NULL,
    params jsonb NOT NULL DEFAULT '{}'::jsonb,
    severity varchar(10) NOT NULL DEFAULT 'warning',
    recipients jsonb NOT NULL DEFAULT '{"roles":["owners","managers"],"userids":[]}'::jsonb,
    channels varchar(20)[] NOT NULL DEFAULT '{inapp}',
    active bool NOT NULL DEFAULT true,
    source varchar(10) NOT NULL DEFAULT 'person',
    instruction text NULL,
    created_by int4 NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    updated_on timestamptz NOT NULL DEFAULT now(),
    archive bool NOT NULL DEFAULT false,
    CONSTRAINT alert_rule_severity_chk CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT alert_rule_source_chk CHECK (source IN ('system', 'person', 'agent'))
);
CREATE INDEX IF NOT EXISTS alert_rule_business_idx ON public.alert_rule (business_id) WHERE NOT archive;

CREATE TABLE IF NOT EXISTS public.notification (
    id bigserial PRIMARY KEY,
    rule_id int4 NOT NULL REFERENCES public.alert_rule(id),
    business_id int4 NOT NULL,
    store_id int4 NULL,
    dedupe_key varchar(120) NOT NULL,
    severity varchar(10) NOT NULL,
    code varchar(60) NOT NULL,
    params jsonb NOT NULL DEFAULT '{}'::jsonb,
    link varchar(200) NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    resolved_on timestamptz NULL
);
-- one open notification per rule and cause: the engine updates it instead of repeating it
CREATE UNIQUE INDEX IF NOT EXISTS notification_open_uq ON public.notification (rule_id, dedupe_key) WHERE resolved_on IS NULL;
CREATE INDEX IF NOT EXISTS notification_business_idx ON public.notification (business_id, resolved_on);

CREATE TABLE IF NOT EXISTS public.notification_state (
    notification_id int8 NOT NULL REFERENCES public.notification(id) ON DELETE CASCADE,
    user_id int4 NOT NULL REFERENCES public.app_user(id),
    read_on timestamptz NULL,
    dismissed_on timestamptz NULL,
    snoozed_until timestamptz NULL,
    PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_pref (
    user_id int4 PRIMARY KEY REFERENCES public.app_user(id),
    language varchar(5) NOT NULL DEFAULT 'en',
    CONSTRAINT notification_pref_language_chk CHECK (language IN ('en', 'ta'))
);

-- Settings > Alerts is for the people who run the business; the notification list needs no permission (it is each person's own)
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"alerts","path":"/secure/settings/alerts","policies":[{"action":"manage"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "alerts")');
