-- Rollback of 220: the closing date and the follow-up link are dropped; reports closed for no response lose that resolution type.
UPDATE public.app_feedback SET resolution_code = NULL WHERE resolution_code = 'no_response';
ALTER TABLE public.app_feedback DROP CONSTRAINT IF EXISTS app_feedback_resolution_code_chk;
ALTER TABLE public.app_feedback ADD CONSTRAINT app_feedback_resolution_code_chk
  CHECK (resolution_code IS NULL OR resolution_code IN ('fixed', 'answered', 'not_a_bug', 'cannot_reproduce', 'not_planned', 'duplicate'));
DROP INDEX IF EXISTS public.app_feedback_follow_up_idx;
ALTER TABLE public.app_feedback DROP COLUMN IF EXISTS follow_up_of;
ALTER TABLE public.app_feedback DROP COLUMN IF EXISTS closed_on;
