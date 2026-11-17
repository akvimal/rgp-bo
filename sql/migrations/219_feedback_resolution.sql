-- 219: help and feedback: a report ends with a resolution type (fixed, answered, not a bug, cannot reproduce, not planned, duplicate), so what came of it
-- can be counted and the reporter reads how it ended. Existing finished reports are given the nearest type.
-- Rollback: 219_rollback.sql.
ALTER TABLE public.app_feedback ADD COLUMN IF NOT EXISTS resolution_code varchar(20) NULL;
ALTER TABLE public.app_feedback DROP CONSTRAINT IF EXISTS app_feedback_resolution_code_chk;
ALTER TABLE public.app_feedback ADD CONSTRAINT app_feedback_resolution_code_chk
  CHECK (resolution_code IS NULL OR resolution_code IN ('fixed', 'answered', 'not_a_bug', 'cannot_reproduce', 'not_planned', 'duplicate'));
UPDATE public.app_feedback SET resolution_code = CASE status WHEN 'ANSWERED' THEN 'answered' WHEN 'DECLINED' THEN 'not_planned' WHEN 'DUPLICATE' THEN 'duplicate' END
 WHERE resolution_code IS NULL AND status IN ('ANSWERED', 'DECLINED', 'DUPLICATE');
