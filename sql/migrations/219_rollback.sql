-- Rollback of 219: the resolution types are dropped (the status and the answer text stay).
ALTER TABLE public.app_feedback DROP CONSTRAINT IF EXISTS app_feedback_resolution_code_chk;
ALTER TABLE public.app_feedback DROP COLUMN IF EXISTS resolution_code;
