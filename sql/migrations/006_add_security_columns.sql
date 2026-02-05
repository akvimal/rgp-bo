-- Migration: Add security-related columns to app_user table
-- Date: 2026-02-05
-- Purpose: Add password management and account security columns

-- Add password_changed_on column
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS password_changed_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add password_history column (stores last 5 password hashes)
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]'::jsonb;

-- Add failed_login_attempts counter
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- Add locked_until timestamp for account lockout
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Add last_login_attempt timestamp
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS last_login_attempt TIMESTAMP WITH TIME ZONE;

-- Update existing users to have password_changed_on set to created_on
UPDATE app_user
SET password_changed_on = created_on
WHERE password_changed_on IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN app_user.password_changed_on IS 'Timestamp when password was last changed';
COMMENT ON COLUMN app_user.password_history IS 'Array of last 5 password hashes to prevent reuse';
COMMENT ON COLUMN app_user.failed_login_attempts IS 'Counter for failed login attempts (resets on success)';
COMMENT ON COLUMN app_user.locked_until IS 'Account locked until this timestamp (null = not locked)';
COMMENT ON COLUMN app_user.last_login_attempt IS 'Timestamp of last login attempt (success or failure)';
