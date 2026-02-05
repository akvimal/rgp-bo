-- Migration 007: Create audit_log table for Railway deployment
-- Purpose: Create audit logging table from scratch (bypassing hr_audit_log rename)
-- Date: 2026-02-05

-- Create audit_log table directly
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    changes JSONB,  -- Legacy column for backward compatibility
    metadata JSONB,  -- Legacy column for backward compatibility
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Foreign key constraint (allows NULL for system actions)
    CONSTRAINT audit_user_fk
        FOREIGN KEY (user_id)
        REFERENCES app_user(id)
        ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, timestamp DESC);

-- Add table and column comments
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for all administrative and HR operations. Captures who did what, when, and tracks before/after state changes.';

COMMENT ON COLUMN audit_log.action IS 'Action types: USER_CREATE, USER_UPDATE, USER_DELETE, ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE, ROLE_ASSIGN, ROLE_REMOVE, PASSWORD_CHANGE, ACCOUNT_LOCK, ACCOUNT_UNLOCK, SETTINGS_UPDATE, SHIFT_CREATE, SHIFT_UPDATE, SHIFT_DELETE, ATTENDANCE_CHECKIN, ATTENDANCE_CHECKOUT, LEAVE_REQUEST_CREATE, LEAVE_REQUEST_APPROVE, LEAVE_REQUEST_REJECT, etc.';

COMMENT ON COLUMN audit_log.resource_type IS 'Resource types: user, role, user_role_assignment, settings, password, account, shift, attendance, leave_request, etc.';

COMMENT ON COLUMN audit_log.old_values IS 'JSONB snapshot of resource state before the action (for UPDATE and DELETE actions)';

COMMENT ON COLUMN audit_log.new_values IS 'JSONB snapshot of resource state after the action (for CREATE and UPDATE actions)';

COMMENT ON COLUMN audit_log.changes IS 'JSONB column for backward compatibility with HR audit logs (legacy)';

COMMENT ON COLUMN audit_log.metadata IS 'JSONB column for additional metadata (legacy)';
