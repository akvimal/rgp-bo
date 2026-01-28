-- Rollback for Migration 008: Administrative Actions Audit Log
-- Purpose: Revert audit_log back to hr_audit_log
-- Date: 2026-01-15

-- Step 1: Rename table back to hr_audit_log
ALTER TABLE audit_log RENAME TO hr_audit_log;

-- Step 2: Rename indexes back to original names
ALTER INDEX idx_audit_user RENAME TO idx_hr_audit_user;
ALTER INDEX idx_audit_resource RENAME TO idx_hr_audit_resource;
ALTER INDEX idx_audit_action RENAME TO idx_hr_audit_action;

-- Step 3: Rename foreign key constraint back
ALTER TABLE hr_audit_log RENAME CONSTRAINT audit_user_fk TO hr_audit_user_fk;

-- Step 4: Drop old_values and new_values columns
ALTER TABLE hr_audit_log DROP COLUMN IF EXISTS old_values;
ALTER TABLE hr_audit_log DROP COLUMN IF EXISTS new_values;

-- Step 5: Remove comments (restore original minimal comments)
COMMENT ON COLUMN hr_audit_log.action IS NULL;
COMMENT ON COLUMN hr_audit_log.resource_type IS NULL;
COMMENT ON COLUMN hr_audit_log.changes IS NULL;
COMMENT ON COLUMN hr_audit_log.metadata IS NULL;
COMMENT ON TABLE hr_audit_log IS NULL;

-- Verification query
SELECT
    COUNT(*) as total_audit_entries,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(timestamp) as oldest_entry,
    MAX(timestamp) as newest_entry
FROM hr_audit_log;
