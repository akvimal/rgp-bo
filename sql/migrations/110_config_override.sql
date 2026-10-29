-- 110: the business's own settings for dashboards, compliance and recognition (RECOGNITION_AND_COMPLIANCE section 10).
-- One row per business, scope, key and start date; the latest row that has begun wins, and the code holds every value inside its floor
-- (api-v2/src/core/config/config-schema.ts). Business level only; per-store targets get their own table later.

CREATE TABLE IF NOT EXISTS public.config_override (
    id serial PRIMARY KEY,
    business_id int4 NOT NULL,
    scope varchar(20) NOT NULL,
    key varchar(60) NOT NULL,
    value jsonb NOT NULL,
    effective_from date NOT NULL,
    created_by int4 NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT config_override_scope_chk CHECK (scope IN ('compliance', 'recognition', 'health', 'views', 'words')),
    CONSTRAINT config_override_uq UNIQUE (business_id, scope, key, effective_from)
);
CREATE INDEX IF NOT EXISTS config_override_business_idx ON public.config_override (business_id, scope);
