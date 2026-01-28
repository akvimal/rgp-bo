-- Migration 008: Administrative Actions Audit Log
-- Purpose: Rename hr_audit_log to audit_log for general-purpose audit logging
-- Issue: #112 - Administrative Actions Audit Log
-- Date: 2026-01-15

-- Step 1: Rename table from hr_audit_log to audit_log
ALTER TABLE hr_audit_log RENAME TO audit_log;

-- Step 2: Rename indexes for consistency
ALTER INDEX idx_hr_audit_user RENAME TO idx_audit_user;
ALTER INDEX idx_hr_audit_resource RENAME TO idx_audit_resource;
ALTER INDEX idx_hr_audit_action RENAME TO idx_audit_action;

-- Step 3: Drop and recreate foreign key constraint to allow NULL user_id
-- (for system-generated actions where no specific user performed the action)
ALTER TABLE audit_log DROP CONSTRAINT hr_audit_user_fk;
ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE audit_log ADD CONSTRAINT audit_user_fk
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE SET NULL;

-- Step 4: Add old_values and new_values columns for before/after state tracking
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Step 5: Update column comments to reflect expanded scope
COMMENT ON COLUMN audit_log.action IS 'Action types: USER_CREATE, USER_UPDATE, USER_DELETE, ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE, ROLE_ASSIGN, ROLE_REMOVE, PASSWORD_CHANGE, ACCOUNT_LOCK, ACCOUNT_UNLOCK, SETTINGS_UPDATE, SHIFT_CREATE, SHIFT_UPDATE, SHIFT_DELETE, ATTENDANCE_CHECKIN, ATTENDANCE_CHECKOUT, LEAVE_REQUEST_CREATE, LEAVE_REQUEST_APPROVE, LEAVE_REQUEST_REJECT, etc.';

COMMENT ON COLUMN audit_log.resource_type IS 'Resource types: user, role, user_role_assignment, settings, password, account, shift, attendance, leave_request, etc.';

COMMENT ON COLUMN audit_log.changes IS 'JSONB column for backward compatibility with HR audit logs (legacy)';

COMMENT ON COLUMN audit_log.metadata IS 'JSONB column for additional metadata (legacy)';

COMMENT ON COLUMN audit_log.old_values IS 'JSONB snapshot of resource state before the action (for UPDATE and DELETE actions)';

COMMENT ON COLUMN audit_log.new_values IS 'JSONB snapshot of resource state after the action (for CREATE and UPDATE actions)';

COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for all administrative and HR operations. Captures who did what, when, and tracks before/after state changes.';

-- Verification query
SELECT
    COUNT(*) as total_audit_entries,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(timestamp) as oldest_entry,
    MAX(timestamp) as newest_entry
FROM audit_log;
