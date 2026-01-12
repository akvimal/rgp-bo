-- Update Payroll Module Permissions for Roles
-- Date: 2026-01-10
-- Purpose: Grant Payroll module access to Admin, Store Head and Sales Staff roles

-- Update Admin role (id: 1) - Full Payroll access including all management features
UPDATE app_role
SET permissions = jsonb_set(
    permissions::jsonb,
    '{11}',
    '{"resource":"payroll","path":["/secure/payroll","/secure/payroll/create","/secure/payroll/salary-structures"],"policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"view.list","properties":[]},{"action":"view.details","properties":[]},{"action":"view.payslip","properties":[]},{"action":"create","properties":[]},{"action":"create.run","properties":[]},{"action":"edit","properties":[]},{"action":"delete","properties":[]},{"action":"calculate","properties":[]},{"action":"approve","properties":[]},{"action":"reject","properties":[]},{"action":"request.payment","properties":[]},{"action":"process.payment","properties":[]},{"action":"salary.read","properties":[]},{"action":"salary.view","properties":[]},{"action":"salary.view.all","properties":[]},{"action":"salary.create","properties":[]},{"action":"salary.edit","properties":[]},{"action":"salary.delete","properties":[]},{"action":"salary.manage","properties":[]},{"action":"export","properties":[]},{"action":"print","properties":[]}]}'::jsonb
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE id = 1;

-- Update Store Head role (id: 3) - Full Payroll access including payroll run approval
UPDATE app_role
SET permissions = jsonb_set(
    permissions::jsonb,
    '{12}',
    '{"resource":"payroll","path":["/secure/payroll","/secure/payroll/create","/secure/payroll/salary-structures"],"policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"view.list","properties":[]},{"action":"view.details","properties":[]},{"action":"view.payslip","properties":[]},{"action":"create","properties":[]},{"action":"create.run","properties":[]},{"action":"edit","properties":[]},{"action":"calculate","properties":[]},{"action":"approve","properties":[]},{"action":"reject","properties":[]},{"action":"salary.read","properties":[]},{"action":"salary.view","properties":[]},{"action":"salary.view.all","properties":[]},{"action":"salary.create","properties":[]},{"action":"salary.edit","properties":[]},{"action":"salary.manage","properties":[]},{"action":"export","properties":[]},{"action":"print","properties":[]}]}'::jsonb
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE id = 3;

-- Update Sales Staff role (id: 2) - View-only Payroll access (can only view their own payslip)
UPDATE app_role
SET permissions = jsonb_set(
    permissions::jsonb,
    '{6}',
    '{"resource":"payroll","path":["/secure/payroll"],"policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"view.payslip","properties":[]},{"action":"payslip.view.own","properties":[]},{"action":"print","properties":[]}]}'::jsonb
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE id = 2;

-- Verify the updates
SELECT id, name,
       jsonb_pretty(permissions::jsonb) as permissions
FROM app_role
WHERE id IN (1, 2, 3)
ORDER BY id;
