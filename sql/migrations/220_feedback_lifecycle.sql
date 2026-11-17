-- 220: help and feedback lifecycle, step 2: a report that goes quiet is closed by itself, and a closed one can be reopened for a while.
--   closed_on     when the report was closed: the reopen window counts from it
--   follow_up_of  a new report raised about one that closed too long ago to reopen
--   resolution_code gains 'no_response' (closed because the reporter did not answer a question)
-- Rollback: 220_rollback.sql.
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS closed_on timestamptz NULL;
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS follow_up_of int4 NULL REFERENCES public.app_feedback(id);
ALTER TABLE public.app_feedback DROP CONSTRAINT IF EXISTS app_feedback_resolution_code_chk;
ALTER TABLE public.app_feedback ADD CONSTRAINT app_feedback_resolution_code_chk
  CHECK (resolution_code IS NULL OR resolution_code IN ('fixed', 'answered', 'not_a_bug', 'cannot_reproduce', 'not_planned', 'duplicate', 'no_response'));
UPDATE public.app_feedback SET closed_on = coalesce(resolved_on, last_activity_on) WHERE status = 'CLOSED' AND closed_on IS NULL;
CREATE INDEX IF NOT EXISTS app_feedback_follow_up_idx ON public.app_feedback (follow_up_of) WHERE follow_up_of IS NOT NULL;
