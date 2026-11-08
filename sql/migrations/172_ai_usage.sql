-- A log of every request the assistant makes to a language model, and a monthly limit on how many it may make.
--  * ai_usage: one row per request (which assistant, which model, did it work, tokens used). Never holds the text sent or received.
--  * app_setting ai.monthly_limit: requests allowed per calendar month (India time); 0 means no limit.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id            serial PRIMARY KEY,
  used_on       timestamptz NOT NULL DEFAULT now(),
  provider      varchar(20),
  model         varchar(120),
  feature       varchar(60) NOT NULL,
  ok            boolean NOT NULL DEFAULT true,
  status        int4,
  input_tokens  int4,
  output_tokens int4,
  ms            int4
);
CREATE INDEX IF NOT EXISTS ai_usage_used_on_idx ON public.ai_usage (used_on);

INSERT INTO public.app_setting (category, setting_key, setting_value, created_by, updated_by)
SELECT 'ai', 'ai.monthly_limit', '300', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'ai.monthly_limit');
