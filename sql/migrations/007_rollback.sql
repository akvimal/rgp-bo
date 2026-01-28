-- Rollback Migration 007: Password Policy & Security Controls
-- Issue #111: Strong Password Policy & Security Controls
-- Date: 2026-01-15
-- Description: Rollback password policy changes

-- ============================================================================
-- 1. Drop functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_account_locked(INTEGER);
DROP FUNCTION IF EXISTS public.is_password_expired(INTEGER);

-- ============================================================================
-- 2. Drop password_reset_token table
-- ============================================================================

DROP TABLE IF EXISTS public.password_reset_token CASCADE;

-- ============================================================================
-- 3. Remove password policy fields from app_user table
-- ============================================================================

ALTER TABLE public.app_user
DROP COLUMN IF EXISTS last_login_attempt;

ALTER TABLE public.app_user
DROP COLUMN IF EXISTS locked_until;

ALTER TABLE public.app_user
DROP COLUMN IF EXISTS failed_login_attempts;

ALTER TABLE public.app_user
DROP COLUMN IF EXISTS password_history;

ALTER TABLE public.app_user
DROP COLUMN IF EXISTS password_changed_on;

-- ============================================================================
-- Rollback complete!
-- ============================================================================

SELECT 'Migration 007 rolled back successfully' AS status;
