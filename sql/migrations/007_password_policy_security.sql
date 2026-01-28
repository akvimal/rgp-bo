-- Migration 007: Password Policy & Security Controls
-- Issue #111: Strong Password Policy & Security Controls
-- Date: 2026-01-15
-- Description: Add password policy fields and password reset token table

-- ============================================================================
-- 1. Add password policy fields to app_user table
-- ============================================================================

-- Add password_changed_on to track when password was last changed
ALTER TABLE public.app_user
ADD COLUMN IF NOT EXISTS password_changed_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add password_history to store last 5 password hashes (JSONB array)
ALTER TABLE public.app_user
ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]'::jsonb;

-- Add failed_login_attempts to track consecutive failed attempts
ALTER TABLE public.app_user
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- Add locked_until to track account lockout expiration
ALTER TABLE public.app_user
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE NULL;

-- Add last_login_attempt to track last login attempt time
ALTER TABLE public.app_user
ADD COLUMN IF NOT EXISTS last_login_attempt TIMESTAMP WITH TIME ZONE NULL;

-- ============================================================================
-- 2. Create password_reset_token table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_token (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,
    ip_address VARCHAR(45) NULL,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT password_reset_token_user_fk FOREIGN KEY (user_id)
        REFERENCES public.app_user(id) ON DELETE CASCADE,
    CONSTRAINT password_reset_token_unique UNIQUE (token)
);

-- Create index for fast lookup by token
CREATE INDEX IF NOT EXISTS idx_password_reset_token_token
    ON public.password_reset_token(token)
    WHERE used = false;

-- Create index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_token_expires
    ON public.password_reset_token(expires_at)
    WHERE used = false;

-- ============================================================================
-- 3. Initialize existing users with password_changed_on = created_on
-- ============================================================================

UPDATE public.app_user
SET password_changed_on = created_on
WHERE password_changed_on IS NULL;

-- ============================================================================
-- 4. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.app_user.password_changed_on IS 'Timestamp when password was last changed. Used to enforce password expiry (90 days).';
COMMENT ON COLUMN public.app_user.password_history IS 'JSONB array storing last 5 password hashes. Prevents password reuse.';
COMMENT ON COLUMN public.app_user.failed_login_attempts IS 'Count of consecutive failed login attempts. Reset to 0 on successful login.';
COMMENT ON COLUMN public.app_user.locked_until IS 'Timestamp until which account is locked. NULL if not locked. Auto-unlocks after 30 minutes.';
COMMENT ON COLUMN public.app_user.last_login_attempt IS 'Timestamp of last login attempt (successful or failed). Used for rate limiting.';

COMMENT ON TABLE public.password_reset_token IS 'Stores password reset tokens sent via email. Tokens expire after 1 hour.';
COMMENT ON COLUMN public.password_reset_token.token IS 'Unique random token sent to user email for password reset verification.';
COMMENT ON COLUMN public.password_reset_token.expires_at IS 'Expiration timestamp (1 hour from creation). Expired tokens cannot be used.';
COMMENT ON COLUMN public.password_reset_token.used IS 'Flag indicating if token has been used. Tokens can only be used once.';

-- ============================================================================
-- 5. Create function to check password expiry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_password_expired(user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    password_age_days INTEGER;
    max_password_age INTEGER := 90; -- Configurable: 90 days default
BEGIN
    SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - password_changed_on))
    INTO password_age_days
    FROM public.app_user
    WHERE id = user_id;

    RETURN password_age_days >= max_password_age;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.is_password_expired(INTEGER) IS 'Returns TRUE if user password is older than 90 days (expired), FALSE otherwise.';

-- ============================================================================
-- 6. Create function to check if account is locked
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_account_locked(user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    lock_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT locked_until
    INTO lock_expiry
    FROM public.app_user
    WHERE id = user_id;

    -- If locked_until is NULL, account is not locked
    IF lock_expiry IS NULL THEN
        RETURN FALSE;
    END IF;

    -- If locked_until is in the future, account is locked
    IF lock_expiry > CURRENT_TIMESTAMP THEN
        RETURN TRUE;
    END IF;

    -- If locked_until is in the past, auto-unlock account
    UPDATE public.app_user
    SET locked_until = NULL,
        failed_login_attempts = 0
    WHERE id = user_id;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.is_account_locked(INTEGER) IS 'Returns TRUE if account is currently locked, FALSE otherwise. Auto-unlocks expired locks.';

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

-- Grant access to password_reset_token table
GRANT SELECT, INSERT, UPDATE ON public.password_reset_token TO rgpapp;
GRANT USAGE, SELECT ON SEQUENCE password_reset_token_id_seq TO rgpapp;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.is_password_expired(INTEGER) TO rgpapp;
GRANT EXECUTE ON FUNCTION public.is_account_locked(INTEGER) TO rgpapp;

-- ============================================================================
-- Migration complete!
-- ============================================================================

-- Verify migration
SELECT
    'Migration 007 completed successfully' AS status,
    COUNT(*) AS total_users,
    COUNT(CASE WHEN password_changed_on IS NOT NULL THEN 1 END) AS users_with_password_date
FROM public.app_user;
