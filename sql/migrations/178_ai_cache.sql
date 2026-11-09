-- 178: fewer AI requests. ai_result_cache keeps the assistant's answer under a fingerprint of what it was based on, so the same question about the same
-- facts is not asked twice; ai_cache_event records each answer served from it, each new request and each refused one (the refresh limits count these, and the
-- usage card will show them). Only the model's answer is kept, never the prompt. Re-runnable.
CREATE TABLE IF NOT EXISTS public.ai_result_cache (
  id          serial4 PRIMARY KEY,
  feature     varchar(60)  NOT NULL,             -- the tool the model is made to call (write_buying_brief ...)
  scope       varchar(80)  NOT NULL,             -- whose answer it is: the stores in scope, a person and period, a week
  fingerprint char(64)     NOT NULL,             -- sha-256 of what the answer was based on
  output      jsonb        NOT NULL,
  model       varchar(120) NULL,
  created_on  timestamptz  NOT NULL DEFAULT now(),
  expires_on  timestamptz  NOT NULL,
  hits        int4         NOT NULL DEFAULT 0,
  last_hit_on timestamptz  NULL,
  created_by  int4         NULL,
  CONSTRAINT ai_result_cache_uq UNIQUE (feature, scope, fingerprint)
);
CREATE INDEX IF NOT EXISTS ai_result_cache_expiry_idx ON public.ai_result_cache (expires_on);

CREATE TABLE IF NOT EXISTS public.ai_cache_event (
  id          serial4 PRIMARY KEY,
  feature     varchar(60) NOT NULL,
  scope       varchar(80) NOT NULL,
  user_id     int4 NULL,
  kind        varchar(8)  NOT NULL,              -- HIT (answer kept), MISS (first request), REFRESH (asked again), REFUSED (over a limit)
  created_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_cache_event_kind_chk CHECK (kind IN ('HIT', 'MISS', 'REFRESH', 'REFUSED'))
);
CREATE INDEX IF NOT EXISTS ai_cache_event_feature_idx ON public.ai_cache_event (feature, scope, created_on);
CREATE INDEX IF NOT EXISTS ai_cache_event_user_idx ON public.ai_cache_event (feature, user_id, created_on);

-- app_setting ai.cache_mode: 'on' keeps answers and applies the refresh limits; 'off' asks the assistant every time, as before (the Business Head's escape hatch)
INSERT INTO public.app_setting (category, setting_key, setting_value, created_by, updated_by)
SELECT 'ai', 'ai.cache_mode', 'on', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'ai.cache_mode');
