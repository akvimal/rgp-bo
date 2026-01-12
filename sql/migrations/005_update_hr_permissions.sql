-- Update HR Module Permissions for Roles
-- Date: 2025-12-01
-- Purpose: Grant HR module access to Store Head and Sales Staff roles

-- Update Store Head role (id: 3) - Full HR access including leave approval
UPDATE app_role
SET permissions = jsonb_set(
    permissions::jsonb,
    '{11}',
    '{"resource":"hr","path":["/secure/hr","/secure/hr/dashboard","/secure/hr/attendance","/secure/hr/leave"],"policies":[{"action":"read","properties":[]},{"action":"attendance.clockin","properties":[]},{"action":"attendance.clockout","properties":[]},{"action":"leave.request","properties":[]},{"action":"leave.approve","properties":[]}]}'::jsonb
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE id = 3;

-- Update Sales Staff role (id: 2) - Basic HR access (no leave approval)
UPDATE app_role
SET permissions = jsonb_set(
    permissions::jsonb,
    '{5}',
    '{"resource":"hr","path":["/secure/hr","/secure/hr/attendance","/secure/hr/leave"],"policies":[{"action":"read","properties":[]},{"action":"attendance.clockin","properties":[]},{"action":"attendance.clockout","properties":[]},{"action":"leave.request","properties":[]}]}'::jsonb
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE id = 2;

-- Verify the updates
SELECT id, name,
       jsonb_pretty(permissions::jsonb) as permissions
FROM app_role
WHERE id IN (2, 3)
ORDER BY id;
